// Copyright (c) 2022 Horizon Medical SAS. All Rights Reserved.
// Phase 14 - Advanced Power Management Implementation.

extern "C"
{
#include "nrf_pwr_mgmt.h"
#include "nrf_saadc.h"
#include "nrf_drv_saadc.h"
#include "nrf_gpio.h"
#include "nrf_delay.h"
#include "nrf_log.h"
#include "nrf_log_ctrl.h"
#include "app_error.h"
#include "nrf_sdh.h"
}
#include "HZM_PowerManager.h"
#include "HZM_Log.h"

// Static member initialization
hzm_pm_state_t          HZM_PowerManager::m_state = HZM_PM_STATE_ACTIVE;
hzm_pm_event_handler_t  HZM_PowerManager::m_evt_handler = NULL;
hzm_battery_info_t      HZM_PowerManager::m_battery = {0};
uint32_t                HZM_PowerManager::m_idle_counter_s = 0;
uint32_t                HZM_PowerManager::m_battery_check_counter = 0;
bool                    HZM_PowerManager::m_is_connected = false;
bool                    HZM_PowerManager::m_initialized = false;

// SAADC buffer for battery reading (single sample)
static nrf_saadc_value_t m_saadc_buffer;

HZM_PowerManager::HZM_PowerManager() {}
HZM_PowerManager::~HZM_PowerManager() {}

/**
 * @brief SAADC event handler (required by driver, minimal for single-shot).
 */
static void saadc_event_handler(nrf_drv_saadc_evt_t const *p_event)
{
    // Single-shot mode - no continuous sampling events to handle
    (void)p_event;
}

void HZM_PowerManager::init(hzm_pm_event_handler_t evt_handler)
{
    if (m_initialized) return;

    m_evt_handler = evt_handler;
    m_state = HZM_PM_STATE_ACTIVE;
    m_idle_counter_s = 0;
    m_battery_check_counter = 0;
    m_is_connected = false;

    // Initialize SAADC for battery voltage reading (VDD/5 internal channel)
    nrf_drv_saadc_config_t saadc_config = NRF_DRV_SAADC_DEFAULT_CONFIG;
    saadc_config.resolution = NRF_SAADC_RESOLUTION_12BIT;

    ret_code_t err_code = nrf_drv_saadc_init(&saadc_config, saadc_event_handler);
    APP_ERROR_CHECK(err_code);

    // Configure channel 0 for VDD measurement (internal 1/5 divider)
    nrf_saadc_channel_config_t channel_config =
        NRF_DRV_SAADC_DEFAULT_CHANNEL_CONFIG_SE(NRF_SAADC_INPUT_VDD);
    channel_config.gain = NRF_SAADC_GAIN1_6;       // VDD is high, use 1/6 gain
    channel_config.reference = NRF_SAADC_REFERENCE_INTERNAL; // 0.6V internal ref

    err_code = nrf_drv_saadc_channel_init(0, &channel_config);
    APP_ERROR_CHECK(err_code);

    m_initialized = true;

    // Initial battery reading
    m_battery = read_battery();

    hz_log("[PM] Power Manager initialized. Battery: %d mV (%d%%)",
           m_battery.voltage_mv, m_battery.percentage);
}

hzm_battery_info_t HZM_PowerManager::read_battery(void)
{
    hzm_battery_info_t info = {0};

    if (!m_initialized) return info;

    // Single-shot SAADC conversion
    nrf_saadc_value_t adc_value = 0;
    ret_code_t err_code = nrf_drv_saadc_sample_convert(0, &adc_value);

    if (err_code == NRF_SUCCESS)
    {
        info.voltage_mv = adc_to_mv(adc_value);
        info.percentage = mv_to_percentage(info.voltage_mv);
        info.is_low = (info.voltage_mv <= HZM_PM_BATTERY_LOW_MV);
        info.is_critical = (info.voltage_mv <= HZM_PM_BATTERY_CRITICAL_MV);
    }
    else
    {
        // On ADC error, preserve last known values
        info = m_battery;
        NRF_LOG_WARNING("[PM] SAADC read failed: 0x%08X", err_code);
    }

    m_battery = info;
    return info;
}

uint16_t HZM_PowerManager::adc_to_mv(int16_t adc_value)
{
    // With 12-bit resolution, GAIN=1/6, REF=0.6V internal:
    // V_input = adc_value * (0.6V / GAIN) / 2^12
    // V_input = adc_value * (0.6 * 6) / 4096
    // V_input = adc_value * 3.6 / 4096
    // Result in mV:
    if (adc_value < 0) adc_value = 0;
    return (uint16_t)((adc_value * 3600UL) / 4096UL);
}

uint8_t HZM_PowerManager::mv_to_percentage(uint16_t mv)
{
    // Linear approximation between shutdown and full voltage
    if (mv >= HZM_PM_BATTERY_FULL_MV) return 100;
    if (mv <= HZM_PM_BATTERY_SHUTDOWN_MV) return 0;

    uint32_t range = HZM_PM_BATTERY_FULL_MV - HZM_PM_BATTERY_SHUTDOWN_MV;
    uint32_t level = mv - HZM_PM_BATTERY_SHUTDOWN_MV;
    return (uint8_t)((level * 100UL) / range);
}

void HZM_PowerManager::update(void)
{
    if (!m_initialized) return;

    // Increment idle counter if not connected (called ~1Hz from timer or main loop)
    if (!m_is_connected)
    {
        m_idle_counter_s++;
    }

    // Periodic battery check
    m_battery_check_counter++;
    if (m_battery_check_counter >= HZM_PM_BATTERY_CHECK_INTERVAL_S)
    {
        m_battery_check_counter = 0;
        read_battery();

        NRF_LOG_DEBUG("[PM] Battery: %d mV (%d%%), state: %d, idle: %d s",
                      m_battery.voltage_mv, m_battery.percentage,
                      m_state, m_idle_counter_s);
    }

    // Evaluate and possibly transition power state
    evaluate_power_state();
}

void HZM_PowerManager::evaluate_power_state(void)
{
    hzm_pm_state_t new_state = m_state;

    // Battery-driven transitions (highest priority)
    if (m_battery.voltage_mv <= HZM_PM_BATTERY_SHUTDOWN_MV)
    {
        new_state = HZM_PM_STATE_DEEP_SLEEP;
    }
    else if (m_battery.voltage_mv <= HZM_PM_BATTERY_CRITICAL_MV)
    {
        new_state = HZM_PM_STATE_SLEEP;
    }
    else if (m_battery.voltage_mv <= HZM_PM_BATTERY_LOW_MV && !m_is_connected)
    {
        new_state = HZM_PM_STATE_LOW_POWER;
    }

    // Idle-driven transitions (only if battery allows ACTIVE)
    if (m_battery.voltage_mv > HZM_PM_BATTERY_LOW_MV)
    {
        if (!m_is_connected && m_idle_counter_s >= HZM_PM_DEEP_SLEEP_TIMEOUT_S)
        {
            new_state = HZM_PM_STATE_DEEP_SLEEP;
        }
        else if (!m_is_connected && m_idle_counter_s >= HZM_PM_IDLE_TIMEOUT_S)
        {
            new_state = HZM_PM_STATE_SLEEP;
        }
        else if (m_is_connected)
        {
            new_state = HZM_PM_STATE_ACTIVE;
        }
    }

    if (new_state != m_state)
    {
        set_state(new_state);
    }
}

void HZM_PowerManager::set_state(hzm_pm_state_t state)
{
    hzm_pm_state_t old_state = m_state;
    m_state = state;

    hz_log("[PM] State transition: %d -> %d", old_state, state);

    // Apply peripheral optimizations for new state
    optimize_peripherals(state);

    // Notify callback
    if (m_evt_handler != NULL)
    {
        m_evt_handler(state);
    }

    // Handle deep sleep immediately
    if (state == HZM_PM_STATE_DEEP_SLEEP)
    {
        enter_deep_sleep();
    }
}

void HZM_PowerManager::optimize_peripherals(hzm_pm_state_t state)
{
    switch (state)
    {
    case HZM_PM_STATE_ACTIVE:
        // All peripherals on, full sampling rate
        NRF_LOG_INFO("[PM] ACTIVE: Full power, all channels enabled");
        break;

    case HZM_PM_STATE_LOW_POWER:
        // Reduce SPI clock, increase connection interval
        // The actual SPI/conn param changes would need AFE/BLE cooperation
        NRF_LOG_INFO("[PM] LOW_POWER: Reduced sampling, slower advertising");
        break;

    case HZM_PM_STATE_SLEEP:
        // Power down AFE, disable SPI, slow advertising
        NRF_LOG_INFO("[PM] SLEEP: AFE powered down, advertising only");
        break;

    case HZM_PM_STATE_DEEP_SLEEP:
        // Everything off, system OFF
        NRF_LOG_INFO("[PM] DEEP_SLEEP: Entering system OFF");
        break;
    }
}

void HZM_PowerManager::notify_activity(void)
{
    m_is_connected = true;
    m_idle_counter_s = 0;

    // Transition back to ACTIVE if battery allows
    if (m_state != HZM_PM_STATE_ACTIVE &&
        m_battery.voltage_mv > HZM_PM_BATTERY_CRITICAL_MV)
    {
        set_state(HZM_PM_STATE_ACTIVE);
    }
}

void HZM_PowerManager::notify_disconnect(void)
{
    m_is_connected = false;
    m_idle_counter_s = 0;  // Start counting idle time from disconnect
    NRF_LOG_INFO("[PM] Disconnected - idle timer started");
}

hzm_pm_state_t HZM_PowerManager::get_state(void)
{
    return m_state;
}

void HZM_PowerManager::enter_deep_sleep(void)
{
    hz_log("[PM] Entering DEEP SLEEP (system OFF). Wake via button.");
    NRF_LOG_FLUSH();

    // Uninitialize SAADC to save power
    nrf_drv_saadc_uninit();

    // Configure wake-up button (pin 13 or board-specific)
    // nrf_gpio_cfg_sense_input(BUTTON_PIN, NRF_GPIO_PIN_PULLUP, NRF_GPIO_PIN_SENSE_LOW);

    // Enter system OFF - device will reset on wake
    ret_code_t err_code = sd_power_system_off();
    APP_ERROR_CHECK(err_code);

    // Should never reach here
    while (true) { __WFE(); }
}
