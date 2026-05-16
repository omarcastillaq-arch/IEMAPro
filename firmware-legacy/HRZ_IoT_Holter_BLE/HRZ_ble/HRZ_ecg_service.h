/* Copyright (c) 2017 Horizon Medical SAS, Cartagena - Colombia. All Rights Reserved.
 *
 * Phase 3 Refactoring: Replaced individual channel handle fields with arrays
 * to eliminate code duplication across 8 ADS1298 channels.
 * BLE Protocol Compatibility: Service UUID 0x805B and Characteristic UUIDs
 * 0x8170-0x8178 remain unchanged.
 */

#ifndef HRZ_ECG_SERVICE_H
#define HRZ_ECG_SERVICE_H

#include <stdint.h>
#include <stdbool.h>
#include "ble.h"
#include "ble_srv_common.h"
#include "nrf_ble_gatt.h"
#include "HRZ_ADS1298.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ============================================================================
 * BLE UUID Definitions - ECG Service (0x805B Protocol)
 * These UUIDs MUST remain unchanged for BLE protocol compatibility with:
 *   - Mobile apps (ecg-broker, HRZ_Ionic_IoT_Holter_App)
 *   - Web BLE viewer (web_ble_ecg)
 *   - BLE logger (ble_logger_db)
 * ============================================================================ */
#define BLE_UUID_ECG_SERVICE                0x805B  /**< ECG service UUID. */
#define BLE_UUID_ECG_STATUS                 0x8170  /**< ECG Status characteristic UUID */

/** @brief Number of ECG channels supported by the ADS1298 AFE */
#define HRZ_ECG_NUM_CHANNELS                8

/** @brief ECG Channel characteristic UUIDs (0x8171 - 0x8178)
 *  Indexed 0-7 corresponding to ADS1298 channels 1-8 */
#define BLE_UUID_ECG_CHANNEL_BASE           0x8171  /**< Base UUID for channel characteristics */
#define BLE_UUID_ECG_CHANNEL_1              0x8171  /**< ECG Channel 1 characteristic UUID */
#define BLE_UUID_ECG_CHANNEL_2              0x8172  /**< ECG Channel 2 characteristic UUID */
#define BLE_UUID_ECG_CHANNEL_3              0x8173  /**< ECG Channel 3 characteristic UUID */
#define BLE_UUID_ECG_CHANNEL_4              0x8174  /**< ECG Channel 4 characteristic UUID */
#define BLE_UUID_ECG_CHANNEL_5              0x8175  /**< ECG Channel 5 characteristic UUID */
#define BLE_UUID_ECG_CHANNEL_6              0x8176  /**< ECG Channel 6 characteristic UUID */
#define BLE_UUID_ECG_CHANNEL_7              0x8177  /**< ECG Channel 7 characteristic UUID */
#define BLE_UUID_ECG_CHANNEL_8              0x8178  /**< ECG Channel 8 characteristic UUID */

/** @brief Data size parameters for BLE ECG packets */
#define HRZ_CHANNEL_LEN                     3       /**< Bytes per sample per channel. 3 for raw, 4 for filtered */
#define HRZ_SAMPLES_PER_PACKET              28      /**< Samples per BLE packet. Max 28 without crashing */
#define HRZ_ECGS_MAX_BUFFER_SIZE            (HRZ_CHANNEL_LEN * HRZ_SAMPLES_PER_PACKET) /**< Total bytes per channel per BLE send (84) */


/* ============================================================================
 * ECG Service Types
 * ============================================================================ */

/**@brief ECG Service event type. */
typedef enum
{
    HRZ_ECGS_EVT_NOTIFICATION_ENABLED,               /**< ECG Samples value notification enabled event. */
    HRZ_ECGS_EVT_NOTIFICATION_DISABLED                /**< ECG Samples value notification disabled event. */
} hrz_ecgs_evt_type_t;

/**@brief ECG Service event. */
typedef struct
{
    hrz_ecgs_evt_type_t evt_type;                     /**< Type of event. */
} hrz_ecgs_evt_t;

// Forward declaration of the hrz_ecgs_t type.
typedef struct hrz_ecgs_s hrz_ecgs_t;

/**@brief ECG Service event handler type. */
typedef void (*hrz_ecgs_evt_handler_t) (hrz_ecgs_t * p_ecgs, hrz_ecgs_evt_t * p_evt);

/**@brief ECG Service init structure. */
typedef struct
{
    hrz_ecgs_evt_handler_t       evt_handler;         /**< Event handler for ECG Service events. */
    ble_srv_cccd_security_mode_t ecgs_attr_md;        /**< Security level for ECG Service attribute */
    ble_srv_cccd_security_mode_t ecg_channel_1_attr_md; /**< Security level for channel attribute (kept for compat) */
} hrz_ecgs_init_t;

/**@brief ECG Service structure.
 * Refactored: Individual ecg_channel_N_handles replaced with
 * ecg_channel_handles[] array indexed by channel (0-7).
 * This eliminates repetitive field access across 8 channels.
 */
struct hrz_ecgs_s
{
    hrz_ecgs_evt_handler_t       evt_handler;                    /**< Event handler for ECG Service events. */
    uint16_t                     service_handle;                 /**< Handle of ECG Service (from BLE stack). */
    ble_gatts_char_handles_t     ecg_status_handles;             /**< Handles for ECG Status characteristic. */
    ble_gatts_char_handles_t     ecg_channel_handles[HRZ_ECG_NUM_CHANNELS]; /**< Handles for ECG channel characteristics [0-7]. */
    uint16_t                     conn_handle;                    /**< Handle of current connection (BLE_CONN_HANDLE_INVALID if none). */
};

/* Backward-compatible macros for accessing individual channel handles.
 * These allow existing code that references m_ecgs.ecg_channel_N_handles
 * to continue working during incremental migration. */
#define ecg_channel_1_handles ecg_channel_handles[0]
#define ecg_channel_2_handles ecg_channel_handles[1]
#define ecg_channel_3_handles ecg_channel_handles[2]
#define ecg_channel_4_handles ecg_channel_handles[3]
#define ecg_channel_5_handles ecg_channel_handles[4]
#define ecg_channel_6_handles ecg_channel_handles[5]
#define ecg_channel_7_handles ecg_channel_handles[6]
#define ecg_channel_8_handles ecg_channel_handles[7]

/**@brief ECG sample structure from ADS1298 */
typedef struct
{
    uint8_t c0 : 4;
    uint8_t loff_stap;
    uint8_t loff_stan;
    uint8_t gpio : 4;
} hrz_ads1298_channel_t;


/* ============================================================================
 * Function Prototypes
 * ============================================================================ */

/**@brief Initialize the ECG Service.
 * @param[out]  p_ecgs      ECG Service structure (initialized by this function).
 * @param[in]   p_ecgs_init Information needed to initialize the service.
 * @return      NRF_SUCCESS on success, otherwise an error code.
 */
uint32_t hrz_ecgs_init(hrz_ecgs_t * p_ecgs, const hrz_ecgs_init_t * p_ecgs_init);

/**@brief Handle BLE Stack events for the ECG Service. */
void hrz_ecgs_on_ble_evt(hrz_ecgs_t * p_ecgs, ble_evt_t * p_ble_evt);

/**@brief Add an ECG characteristic to the service. */
uint32_t hrz_ecg_char_add(hrz_ecgs_t * p_ecgs,
                          ble_gatts_char_handles_t * char_handle,
                          uint16_t ble_uuid_value);

void on_connect(hrz_ecgs_t * p_ecgs, ble_evt_t * p_ble_evt);
void on_disconnect(hrz_ecgs_t * p_ecgs, ble_evt_t * p_ble_evt);
void on_write(hrz_ecgs_t * p_ecgs, ble_evt_t * p_ble_evt);

/**@brief Send ECG data over BLE notification.
 * @param[in]   p_ecgs        ECG Service structure.
 * @param[in]   char_handles  Handles of the characteristic to notify.
 * @param[in]   data          Data to send.
 * @param[in]   len           Length of data to send.
 * @return      NRF_SUCCESS on success, otherwise an error code.
 */
uint32_t hrz_ecg_send(hrz_ecgs_t * p_ecgs,
                      ble_gatts_char_handles_t char_handles,
                      uint8_t * data,
                      uint16_t len);

#ifdef __cplusplus
}
#endif

#endif // HRZ_ECG_SERVICE_H
