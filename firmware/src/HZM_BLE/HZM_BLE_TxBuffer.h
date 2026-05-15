// Copyright (c) 2022 Horizon Medical SAS. All Rights Reserved.
// Phase 14 - Optimized BLE Transmission Buffer for reduced latency.

#ifndef HZM_BLE_TX_BUFFER_H
#define HZM_BLE_TX_BUFFER_H

extern "C"
{
#include <stdint.h>
#include <stdbool.h>
#include "ble_gatts.h"
}

/**
 * @defgroup HZM_BLE_TX_BUFFER Optimized BLE Transmission Buffer
 * @brief Double-buffered, prioritized BLE notification queue.
 *
 * Problems solved:
 * 1. NRF_ERROR_RESOURCES: SoftDevice TX buffer full → data loss
 * 2. Latency: Waiting for one channel to finish before sending next
 * 3. Priority: All channels treated equally, no medical priority
 *
 * Solution:
 * - Double-buffered ring queue: producer (AFE ISR) and consumer (BLE TX)
 *   operate on separate buffers → zero-copy handoff
 * - BLE_GATTS_EVT_HVN_TX_COMPLETE event triggers batch drain
 * - Retry queue for NRF_ERROR_RESOURCES without blocking main loop
 * - Statistics tracking for monitoring TX health
 *
 * Buffer sizing:
 * - 8 channels × 84 bytes per packet = 672 bytes per frame
 * - Queue depth of 4 frames allows ~120ms of buffering at 500 SPS
 * @{
 */

/// Maximum number of queued BLE notifications
#define HZM_TX_QUEUE_DEPTH          32      ///< Max pending notifications (4 frames × 8 ch)
/// Maximum payload size per notification
#define HZM_TX_MAX_PAYLOAD          84      ///< HRZ_ECGS_MAX_BUFFER_SIZE
/// Number of channels
#define HZM_TX_NUM_CHANNELS         8

/// Initial TX buffer count requested from SoftDevice
#define HZM_TX_SOFTDEVICE_BUFFERS   6       ///< Request 6 TX buffers from SoftDevice

/** @} */

/// Single TX queue entry
typedef struct {
    ble_gatts_char_handles_t handle;            ///< GATT characteristic handle
    uint8_t  data[HZM_TX_MAX_PAYLOAD];          ///< Payload data
    uint16_t len;                               ///< Payload length
    uint8_t  channel_idx;                       ///< Channel index (0-7) for priority
    uint8_t  retry_count;                       ///< Number of retries attempted
    bool     valid;                             ///< Entry is valid/in-use
} hzm_tx_entry_t;

/// TX buffer statistics
typedef struct {
    uint32_t total_queued;          ///< Total notifications queued
    uint32_t total_sent;            ///< Total successfully sent
    uint32_t total_dropped;         ///< Total dropped (queue full)
    uint32_t total_retries;         ///< Total retry attempts
    uint32_t resource_errors;       ///< NRF_ERROR_RESOURCES count
    uint32_t max_queue_depth;       ///< Maximum queue depth observed
    uint16_t current_queue_depth;   ///< Current queue depth
    uint16_t avg_latency_us;        ///< Average TX latency (estimated)
} hzm_tx_stats_t;

class HZM_BLE_TxBuffer
{
public:
    HZM_BLE_TxBuffer();
    ~HZM_BLE_TxBuffer();

    /**
     * @brief Initialize the TX buffer system.
     * @param conn_handle Current BLE connection handle.
     */
    static void init(uint16_t conn_handle);

    /**
     * @brief Queue a notification for transmission.
     * Non-blocking: returns immediately. Data is copied into internal buffer.
     * @param handle GATT characteristic handles.
     * @param data   Pointer to payload data.
     * @param len    Payload length in bytes.
     * @param channel_idx Channel index (0-7) for priority ordering.
     * @return true if queued successfully, false if queue is full.
     */
    static bool queue(ble_gatts_char_handles_t handle,
                      const uint8_t *data, uint16_t len,
                      uint8_t channel_idx);

    /**
     * @brief Drain the TX queue - send as many queued notifications as possible.
     * Call this from the main loop and from BLE_GATTS_EVT_HVN_TX_COMPLETE handler.
     * Stops when SoftDevice TX buffers are exhausted (NRF_ERROR_RESOURCES).
     * @param conn_handle Current connection handle.
     * @return Number of notifications successfully sent in this drain cycle.
     */
    static uint8_t drain(uint16_t conn_handle);

    /**
     * @brief Handle TX complete event from SoftDevice.
     * Called when BLE stack confirms notification delivery, freeing TX buffers.
     * @param count Number of TX buffers freed.
     */
    static void on_tx_complete(uint8_t count);

    /**
     * @brief Update connection handle (e.g., on new connection).
     */
    static void set_conn_handle(uint16_t conn_handle);

    /**
     * @brief Reset the buffer (e.g., on disconnect).
     */
    static void reset(void);

    /**
     * @brief Get current TX statistics.
     */
    static hzm_tx_stats_t get_stats(void);

    /**
     * @brief Check if queue has pending entries.
     */
    static bool has_pending(void);

    /**
     * @brief Get current queue occupancy.
     */
    static uint16_t get_queue_depth(void);

private:
    static hzm_tx_entry_t  m_queue[HZM_TX_QUEUE_DEPTH];
    static uint8_t         m_head;          ///< Next slot to write (producer)
    static uint8_t         m_tail;          ///< Next slot to read (consumer)
    static uint16_t        m_count;         ///< Current entries in queue
    static uint16_t        m_conn_handle;
    static hzm_tx_stats_t  m_stats;
    static uint8_t         m_available_tx_buffers; ///< SoftDevice TX buffers available
    static bool            m_initialized;

    /**
     * @brief Attempt to send a single entry via SoftDevice.
     * @return NRF_SUCCESS or error code.
     */
    static uint32_t send_entry(hzm_tx_entry_t *entry, uint16_t conn_handle);
};

#endif // HZM_BLE_TX_BUFFER_H
