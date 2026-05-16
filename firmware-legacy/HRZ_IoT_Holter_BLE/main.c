/* Copyright (c) 2017 Horizon Medical SAS, Cartagena - Colombia.
 * All Rights Reserved.
 *
 * Phase 3 Refactoring:
 * - Uses encapsulated device state via g_ads1298_state / macros
 * - Main loop logic unchanged; data flow remains:
 *   DRDY interrupt → SPI read → buffer fill → BLE send
 * - Added structured comments for medical device documentation
 */

#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include "HRZ_ble.h"
#include "HRZ_ADS1298.h"

#ifndef FIR_FILTER_ENABLED
#define FIR_FILTER_ENABLED 0
#endif

#define NRF_LOG_MODULE_NAME "MAIN"
#include "nrf_log.h"
#include "nrf_log_ctrl.h"

/**@brief Application main entry point.
 *
 * Initializes all hardware peripherals, BLE stack, and the ADS1298 AFE.
 * Then enters the main loop which:
 *   1. Processes NRF log queue
 *   2. Reads ADS1298 data when DRDY interrupt fires
 *   3. Sends accumulated samples over BLE when packet is full
 *   4. Enters low-power wait state when idle
 *
 * Data flow:
 *   ADS1298 DRDY interrupt → hrz_get_ads1298_data() (collects 28 samples)
 *   → ble_packet_ready flag → hrz_send_data_over_BLE() (8 channels × 84 bytes)
 *
 * BLE Protocol: Service UUID 0x805B, Channels on UUIDs 0x8171-0x8178
 */
int main(void)
{
    bool erase_bonds;

    /* === Initialization Phase === */

    /* Logging subsystem */
    log_init();
    NRF_LOG_RAW_INFO("\r\n");
    NRF_LOG_RAW_INFO("  HORIZON MEDICAL\r\n");
    NRF_LOG_RAW_INFO("IoT Holter BLE v1.0\r\n");
    NRF_LOG_RAW_INFO("  (Refactored v3.0)\r\n");
    NRF_LOG_RAW_INFO("===================\r\n");
    NRF_LOG_RAW_INFO("\r\n");

    /* BLE and peripheral initialization */
    timers_init();
    buttons_leds_init(&erase_bonds);
    ble_stack_init();
    gap_params_init();
    gatt_init();
    advertising_init();
    services_init();       /* Registers ECG Service 0x805B with 8 channel characteristics */
    hrz_ads1298_init();    /* Configures ADS1298 AFE via SPI */
    conn_params_init();
    peer_manager_init();

    /* === Start Execution === */
    application_timers_start();
    advertising_start(erase_bonds);

    NRF_LOG_INFO("System initialized, entering main loop\r\n");

    /* === Main Loop === */
    for (;;)
    {
        if (NRF_LOG_PROCESS() == false)
        {
            /* Check if ADS1298 has new data available (set by DRDY interrupt).
             * The ads1298_data_ready macro maps to g_ads1298_state.data_ready */
            if (ads1298_data_ready)
            {
                ads1298_data_ready = false;
                hrz_get_ads1298_data();

                /* Send data over BLE when enough samples are collected.
                 * The ble_packet_ready macro maps to g_ads1298_state.ble_packet_ready */
                if (ble_packet_ready)
                {
                    #if FIR_FILTER_ENABLED
                        hrz_filter_data();
                        hrz_send_filtered_data_over_BLE();
                    #else
                        hrz_send_data_over_BLE();
                    #endif
                }
            }

            /* Enter low-power state until next event */
            power_manage();
        }
    }
}

/**@brief Application error fault handler.
 *
 * Called by APP_ERROR_CHECK and other error macros.
 * Flushes logs, prints error info, and halts the system.
 * In a production medical device, this should trigger a safe
 * shutdown and alert the user.
 *
 * @param id    Fault identifier
 * @param pc    Program counter at fault
 * @param info  Additional fault information
 */
void app_error_fault_handler(uint32_t id, uint32_t pc, uint32_t info)
{
    NRF_LOG_ERROR("FATAL: fault_id=0x%08X, pc=0x%08X\r\n", id, pc);
    NRF_LOG_FINAL_FLUSH();
    app_error_print(id, pc, info);
    app_error_save_and_stop(id, pc, info);
}
