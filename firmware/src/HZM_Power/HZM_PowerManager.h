// Copyright (c) 2022 Horizon Medical SAS. All Rights Reserved.
// Phase 14 - Advanced Power Management for extended battery life.

#ifndef HZM_POWER_MANAGER_H
#define HZM_POWER_MANAGER_H

extern "C"
{
#include <stdint.h>
#include <stdbool.h>
}

/**
 * @defgroup HZM_POWER_MANAGER Advanced Power Management
 * @brief Extends battery life through intelligent power state transitions.
 *
 * Power States:
 *  ACTIVE      - Full sampling (500 SPS), BLE connected, all channels on
 *  LOW_POWER   - Reduced sampling (250 SPS), longer advertising interval
 *  SLEEP       - AFE powered down, BLE advertising only (slow)
 *  DEEP_SLEEP  - System OFF, wake via button/GPIO only
 *
 * Battery monitoring via nRF52 SAADC on internal VDD channel.
 * Transitions based on battery level + connection state.
 * @{
 */

/// Battery voltage thresholds in millivolts (for CR2032 or LiPo)
#define HZM_PM_BATTERY_FULL_MV          3000    ///< Battery considered full
#define HZM_PM_BATTERY_LOW_MV           2400    ///< Switch to LOW_POWER mode
#define HZM_PM_BATTERY_CRITICAL_MV      2200    ///< Switch to SLEEP mode
#define HZM_PM_BATTERY_SHUTDOWN_MV      2100    ///< Enter DEEP_SLEEP (system off)

/// Idle timeout before auto-sleep (in seconds)
#define HZM_PM_IDLE_TIMEOUT_S           300     ///< 5 minutes without connection → SLEEP
#define HZM_PM_DEEP_SLEEP_TIMEOUT_S     600     ///< 10 minutes idle in SLEEP → DEEP_SLEEP

/// ADC sampling for battery (internal VDD/5 on AIN0 not needed; use SAADC VDD)
#define HZM_PM_BATTERY_CHECK_INTERVAL_S 30      ///< Check battery every 30s

/// Advertising intervals per power state (units of 0.625 ms)
#define HZM_PM_ADV_INTERVAL_ACTIVE      300     ///< 187.5 ms (fast)
#define HZM_PM_ADV_INTERVAL_LOW_POWER   800     ///< 500 ms (moderate)
#define HZM_PM_ADV_INTERVAL_SLEEP       3200    ///< 2000 ms (slow, saves power)

/** @} */

/// Power states
typedef enum {
    HZM_PM_STATE_ACTIVE = 0,
    HZM_PM_STATE_LOW_POWER,
    HZM_PM_STATE_SLEEP,
    HZM_PM_STATE_DEEP_SLEEP
} hzm_pm_state_t;

/// Battery info structure
typedef struct {
    uint16_t voltage_mv;        ///< Current battery voltage in mV
    uint8_t  percentage;        ///< Estimated percentage (0-100)
    bool     is_low;            ///< Below LOW threshold
    bool     is_critical;       ///< Below CRITICAL threshold
} hzm_battery_info_t;

/// Power event callback type
typedef void (*hzm_pm_event_handler_t)(hzm_pm_state_t new_state);

class HZM_PowerManager
{
public:
    HZM_PowerManager();
    ~HZM_PowerManager();

    /**
     * @brief Initialize the advanced power manager.
     * Sets up SAADC for battery monitoring, starts periodic check timer.
     * @param evt_handler Optional callback for power state changes (can be NULL).
     */
    static void init(hzm_pm_event_handler_t evt_handler);

    /**
     * @brief Periodic update - call from main loop or timer callback.
     * Checks idle timeout and triggers state transitions as needed.
     */
    static void update(void);

    /**
     * @brief Read battery voltage and update internal state.
     * @return Current battery info.
     */
    static hzm_battery_info_t read_battery(void);

    /**
     * @brief Get current power state.
     */
    static hzm_pm_state_t get_state(void);

    /**
     * @brief Notify power manager that device is actively connected.
     * Resets idle timer and may transition to ACTIVE state.
     */
    static void notify_activity(void);

    /**
     * @brief Notify power manager that BLE disconnected.
     * Starts idle timer countdown.
     */
    static void notify_disconnect(void);

    /**
     * @brief Force a specific power state (e.g., for button-triggered sleep).
     */
    static void set_state(hzm_pm_state_t state);

    /**
     * @brief Enter system-off deep sleep. Only GPIO/button can wake.
     */
    static void enter_deep_sleep(void);

    /**
     * @brief Disable unused peripherals to save power.
     * Called automatically on state transitions.
     */
    static void optimize_peripherals(hzm_pm_state_t state);

private:
    static hzm_pm_state_t          m_state;
    static hzm_pm_event_handler_t  m_evt_handler;
    static hzm_battery_info_t      m_battery;
    static uint32_t                m_idle_counter_s;
    static uint32_t                m_battery_check_counter;
    static bool                    m_is_connected;
    static bool                    m_initialized;

    /**
     * @brief Convert raw ADC value to millivolts.
     */
    static uint16_t adc_to_mv(int16_t adc_value);

    /**
     * @brief Convert millivolts to battery percentage (linear approx).
     */
    static uint8_t mv_to_percentage(uint16_t mv);

    /**
     * @brief Evaluate battery level and trigger state transitions.
     */
    static void evaluate_power_state(void);
};

#endif // HZM_POWER_MANAGER_H
