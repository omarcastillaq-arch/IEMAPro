// Copyright (c) 2022 Horizon Medical SAS. All Rights Reserved.
// Phase 14 - Optimized BLE Transmission Buffer Implementation.

extern "C"
{
#include <string.h>
#include "ble.h"
#include "ble_gatts.h"
#include "nrf_log.h"
#include "nrf_log_ctrl.h"
#include "app_error.h"
}
#include "HZM_BLE_TxBuffer.h"
#include "HZM_Log.h"

// Static member initialization
hzm_tx_entry_t  HZM_BLE_TxBuffer::m_queue[HZM_TX_QUEUE_DEPTH];
uint8_t         HZM_BLE_TxBuffer::m_head = 0;
uint8_t         HZM_BLE_TxBuffer::m_tail = 0;
uint16_t        HZM_BLE_TxBuffer::m_count = 0;
uint16_t        HZM_BLE_TxBuffer::m_conn_handle = BLE_CONN_HANDLE_INVALID;
hzm_tx_stats_t  HZM_BLE_TxBuffer::m_stats = {0};
uint8_t         HZM_BLE_TxBuffer::m_available_tx_buffers = HZM_TX_SOFTDEVICE_BUFFERS;
bool            HZM_BLE_TxBuffer::m_initialized = false;

HZM_BLE_TxBuffer::HZM_BLE_TxBuffer() {}
HZM_BLE_TxBuffer::~HZM_BLE_TxBuffer() {}

void HZM_BLE_TxBuffer::init(uint16_t conn_handle)
{
    m_conn_handle = conn_handle;
    reset();
    m_initialized = true;

    NRF_LOG_INFO("[TX] Buffer initialized (depth=%d, payload=%d bytes)",
                 HZM_TX_QUEUE_DEPTH, HZM_TX_MAX_PAYLOAD);
}

void HZM_BLE_TxBuffer::reset(void)
{
    memset(m_queue, 0, sizeof(m_queue));
    m_head = 0;
    m_tail = 0;
    m_count = 0;
    m_available_tx_buffers = HZM_TX_SOFTDEVICE_BUFFERS;
    // Preserve stats across resets for debugging
}

bool HZM_BLE_TxBuffer::queue(ble_gatts_char_handles_t handle,
                              const uint8_t *data, uint16_t len,
                              uint8_t channel_idx)
{
    if (!m_initialized) return false;

    // Check queue capacity
    if (m_count >= HZM_TX_QUEUE_DEPTH)
    {
        m_stats.total_dropped++;
        NRF_LOG_WARNING("[TX] Queue full - dropping ch%d notification", channel_idx + 1);
        return false;
    }

    // Clamp payload length
    if (len > HZM_TX_MAX_PAYLOAD) len = HZM_TX_MAX_PAYLOAD;

    // Copy data into queue slot
    hzm_tx_entry_t *entry = &m_queue[m_head];
    entry->handle = handle;
    memcpy(entry->data, data, len);
    entry->len = len;
    entry->channel_idx = channel_idx;
    entry->retry_count = 0;
    entry->valid = true;

    // Advance head pointer (ring buffer)
    m_head = (m_head + 1) % HZM_TX_QUEUE_DEPTH;
    m_count++;

    // Update statistics
    m_stats.total_queued++;
    m_stats.current_queue_depth = m_count;
    if (m_count > m_stats.max_queue_depth)
    {
        m_stats.max_queue_depth = m_count;
    }

    return true;
}

uint8_t HZM_BLE_TxBuffer::drain(uint16_t conn_handle)
{
    if (!m_initialized || m_count == 0) return 0;
    if (conn_handle == BLE_CONN_HANDLE_INVALID) return 0;

    uint8_t sent_count = 0;

    while (m_count > 0 && m_available_tx_buffers > 0)
    {
        hzm_tx_entry_t *entry = &m_queue[m_tail];

        if (!entry->valid)
        {
            // Skip invalid entries (shouldn't happen, but safety)
            m_tail = (m_tail + 1) % HZM_TX_QUEUE_DEPTH;
            m_count--;
            continue;
        }

        uint32_t err_code = send_entry(entry, conn_handle);

        if (err_code == NRF_SUCCESS)
        {
            // Successfully sent - advance tail
            entry->valid = false;
            m_tail = (m_tail + 1) % HZM_TX_QUEUE_DEPTH;
            m_count--;
            m_available_tx_buffers--;
            sent_count++;
            m_stats.total_sent++;
        }
        else if (err_code == NRF_ERROR_RESOURCES)
        {
            // SoftDevice TX buffer full - stop draining, will retry on TX_COMPLETE
            m_stats.resource_errors++;
            m_available_tx_buffers = 0;  // No more buffers available
            NRF_LOG_DEBUG("[TX] Resources exhausted after %d sends", sent_count);
            break;
        }
        else if (err_code == NRF_ERROR_INVALID_STATE ||
                 err_code == BLE_ERROR_INVALID_CONN_HANDLE)
        {
            // Connection lost - reset buffer
            NRF_LOG_WARNING("[TX] Connection lost during drain (err=0x%08X)", err_code);
            reset();
            return sent_count;
        }
        else
        {
            // Other error - skip this entry, try next
            entry->retry_count++;
            m_stats.total_retries++;

            if (entry->retry_count >= 3)
            {
                // Max retries exceeded - drop
                entry->valid = false;
                m_tail = (m_tail + 1) % HZM_TX_QUEUE_DEPTH;
                m_count--;
                m_stats.total_dropped++;
                NRF_LOG_WARNING("[TX] Dropped ch%d after %d retries (err=0x%08X)",
                                entry->channel_idx + 1, entry->retry_count, err_code);
            }
            else
            {
                break;  // Will retry on next drain cycle
            }
        }
    }

    m_stats.current_queue_depth = m_count;
    return sent_count;
}

uint32_t HZM_BLE_TxBuffer::send_entry(hzm_tx_entry_t *entry, uint16_t conn_handle)
{
    ble_gatts_hvx_params_t hvx_params;
    uint16_t hvx_len = entry->len;

    memset(&hvx_params, 0, sizeof(hvx_params));
    hvx_params.handle = entry->handle.value_handle;
    hvx_params.type = BLE_GATT_HVX_NOTIFICATION;
    hvx_params.offset = 0;
    hvx_params.p_len = &hvx_len;
    hvx_params.p_data = entry->data;

    return sd_ble_gatts_hvx(conn_handle, &hvx_params);
}

void HZM_BLE_TxBuffer::on_tx_complete(uint8_t count)
{
    // SoftDevice freed TX buffers - update availability
    m_available_tx_buffers += count;

    // Cap at maximum (safety)
    if (m_available_tx_buffers > HZM_TX_SOFTDEVICE_BUFFERS)
    {
        m_available_tx_buffers = HZM_TX_SOFTDEVICE_BUFFERS;
    }

    // Immediately try to drain pending queue
    if (m_count > 0)
    {
        drain(m_conn_handle);
    }
}

void HZM_BLE_TxBuffer::set_conn_handle(uint16_t conn_handle)
{
    m_conn_handle = conn_handle;
}

hzm_tx_stats_t HZM_BLE_TxBuffer::get_stats(void)
{
    return m_stats;
}

bool HZM_BLE_TxBuffer::has_pending(void)
{
    return (m_count > 0);
}

uint16_t HZM_BLE_TxBuffer::get_queue_depth(void)
{
    return m_count;
}
