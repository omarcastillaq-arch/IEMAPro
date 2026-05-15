// Copyright (c) 2022 Horizon Medical SAS. All Rights Reserved.

#include "HZM_BLE.h"
#include "HZM_BLE_TxBuffer.h"
#include "HZM_LED.h"
#include "HZM_Button.h"
#include "HZM_Log.h"
#include "HZM_Power.h"
#include "HZM_PowerManager.h"
#include "HZM_Timer.h"
#include "HZM_AFE.h"
#include "HZM_LeadOff.h"

extern "C"
{
#include "nrf_ble_lesc.h"
}

/**
 * @brief Power state change callback.
 * Adjusts AFE and advertising based on power state transitions.
 */
static void on_power_state_change(hzm_pm_state_t new_state)
{
    switch (new_state)
    {
    case HZM_PM_STATE_ACTIVE:
        // Full operation - AFE should be running if connected
        hz_log("[MAIN] Power: ACTIVE mode");
        break;

    case HZM_PM_STATE_LOW_POWER:
        hz_log("[MAIN] Power: LOW_POWER mode - reducing activity");
        break;

    case HZM_PM_STATE_SLEEP:
        // Stop AFE to save power, BLE advertising continues (slow)
        HZM_AFE::stop();
        hz_log("[MAIN] Power: SLEEP mode - AFE stopped");
        break;

    case HZM_PM_STATE_DEEP_SLEEP:
        // PowerManager handles system OFF internally
        hz_log("[MAIN] Power: DEEP_SLEEP - shutting down");
        break;
    }
}

/**
 * @brief Lead-off event callback.
 * Notifies user via LED pattern when electrodes disconnect.
 */
static void on_leadoff_change(const hzm_leadoff_status_t *status)
{
    if (status->any_off)
    {
        hz_log("[MAIN] LEAD-OFF: %d channels disconnected (mask=0x%02X)",
               status->off_count, status->raw_statp | status->raw_statn);
        // Rapid LED blink to alert user of disconnected electrodes
        // (LED pattern could be extended with HZM_LED)
    }
    else
    {
        hz_log("[MAIN] All electrodes connected");
    }
}

/**
 * @brief Application main entry point.
 *
 * Initialization sequence:
 * 1. Logging, timers, power management (basic + advanced)
 * 2. BLE stack (SoftDevice)
 * 3. GAP, GATT, advertising, services (with encrypted CCCD)
 * 4. Connection parameters, Peer Manager
 * 5. BLE Security (LESC + bonding)
 * 6. BLE TX Buffer (optimized transmission queue)
 * 7. Peripherals (LED, button, AFE)
 * 8. Lead-off detection
 * 9. Advanced power manager (battery monitoring)
 *
 * Main loop:
 * - Reads button state for LED control
 * - Reads AFE data when ready + processes lead-off status
 * - Sends ECG data via optimized TX buffer (encrypted only)
 * - Drains TX buffer on each iteration for low latency
 * - Handles LESC key computation requests
 * - Updates power manager (battery check, idle timeout)
 * - Enters idle/sleep when no work pending
 */
int main(void)
{
    bool erase_bonds = false;

    // 1. Initialize logging and basic infrastructure
    HZM_Log::log_init();
    hz_log("\r\n\r\nHORIZON MEDICAL IoT Holter v2.0 (Secure BLE + Power Mgmt)");
    HZM_Timer::timers_init();
    HZM_Power::power_management_init();

    // 2-4. BLE stack, GAP, GATT, services, connection params, Peer Manager
    HZM_BLE::ble_stack_init();
    HZM_BLE::gap_params_init();
    HZM_BLE::gatt_init();
    HZM_BLE::advertising_init();
    HZM_BLE::services_init();
    HZM_BLE::conn_params_init();
    HZM_BLE::peer_manager_init();

    // 5. BLE Security (LESC + bonding)
    HZM_BLE::security_init();

    // 6. Optimized BLE TX buffer
    HZM_BLE_TxBuffer::init(BLE_CONN_HANDLE_INVALID);

    // 7. Peripherals
    HZM_LED::init();
    HZM_Button::init(&erase_bonds);
    HZM_AFE::init();

    // 8. Lead-off detection
    HZM_LeadOff::init(on_leadoff_change);
    HZM_LeadOff::configure_ads1298_leadoff();

    // 9. Advanced power manager (battery monitoring + auto-sleep)
    HZM_PowerManager::init(on_power_state_change);

    // Start execution
    hz_log("Execution started (LESC + PowerMgr + LeadOff + TxBuffer).");
    HZM_Timer::application_timers_start();
    HZM_BLE::advertising_start(erase_bonds);

    // Enter main loop
    for (;;)
    {
        // Button → LED control
        HZM_Button::read() ? HZM_LED::turn_on() : HZM_LED::turn_off();

        // AFE data acquisition with lead-off detection
        if (HZM_AFE::data_ready)
        {
            HZM_AFE::read_data();

            // Process lead-off status from ADS1298 status bytes
            // (status bytes are in m_rx_buf[0..2] from the SPI frame)
            HZM_LeadOff::process_status(
                HZM_AFE::m_rx_buf[0],
                HZM_AFE::m_rx_buf[1],
                HZM_AFE::m_rx_buf[2]);

            if (HZM_AFE::data_read)
            {
                // send_data_over_BLE() internally checks encryption state
                // and drops data if link is not encrypted
                HZM_BLE::send_data_over_BLE();
            }
        }

        // Drain TX buffer - send any pending notifications
        // This reduces latency by attempting to send on every loop iteration
        HZM_BLE_TxBuffer::drain(BLE_CONN_HANDLE_INVALID);

        // Process LESC DH key computation requests from SoftDevice
        nrf_ble_lesc_request_handler();

        // Update power manager (battery check, idle timeout, state transitions)
        HZM_PowerManager::update();

        // Enter idle/sleep when no work pending
        HZM_Power::idle_state_handle();
    }
}
