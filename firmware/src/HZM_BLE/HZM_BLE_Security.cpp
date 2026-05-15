/**
 * @file HZM_BLE_Security.cpp
 * @brief BLE Security Module implementation for Horizon Medical IoT Holter
 *
 * Implements LE Secure Connections (LESC) with bonding, encrypted
 * characteristic access, authorized device validation, and comprehensive
 * security event handling for medical-grade BLE communication.
 *
 * Security features:
 * - LESC (LE Secure Connections) with ECDH P-256 key exchange
 * - Bonding with LTK/IRK key distribution for persistent encryption
 * - MITM protection via Numeric Comparison (when IO caps allow)
 * - Encrypted CCCD and characteristic value access
 * - Authorized device whitelist via Peer Manager bonds
 * - Consecutive auth failure lockout
 *
 * @copyright Copyright (c) 2024 Horizon Medical
 */

extern "C"
{
#include <string.h>
#include "sdk_common.h"
#include "nrf_log.h"
#include "nrf_log_ctrl.h"
#include "ble.h"
#include "ble_hci.h"
#include "ble_gap.h"
#include "ble_conn_state.h"
#include "peer_manager.h"
#include "peer_manager_handler.h"
#include "nrf_ble_lesc.h"
#include "app_error.h"
}

#include "HZM_BLE_Security.h"

// ============================================================================
// Static member initialization
// ============================================================================

hzm_sec_state_t       HZM_BLE_Security::m_security_state     = HZM_SEC_STATE_DISCONNECTED;
hzm_sec_evt_handler_t HZM_BLE_Security::m_evt_handler         = NULL;
uint16_t              HZM_BLE_Security::m_current_conn_handle = BLE_CONN_HANDLE_INVALID;
pm_peer_id_t          HZM_BLE_Security::m_current_peer_id     = PM_PEER_ID_INVALID;
uint32_t              HZM_BLE_Security::m_auth_failure_count   = 0;

// ============================================================================
// Public API
// ============================================================================

/**
 * @brief Initialize the BLE security module.
 *
 * Generates the LESC OOB data (ECDH public key pair) needed for
 * LE Secure Connections. The nrf_ble_lesc module handles the DH key
 * computation during pairing automatically.
 */
void HZM_BLE_Security::init(hzm_sec_evt_handler_t evt_handler)
{
    ret_code_t err_code;

    m_evt_handler         = evt_handler;
    m_security_state      = HZM_SEC_STATE_DISCONNECTED;
    m_current_conn_handle = BLE_CONN_HANDLE_INVALID;
    m_current_peer_id     = PM_PEER_ID_INVALID;
    m_auth_failure_count  = 0;

    // Initialize LESC module for LE Secure Connections
    // This generates the ECDH key pair used during LESC pairing
    err_code = nrf_ble_lesc_init();
    APP_ERROR_CHECK(err_code);

    NRF_LOG_INFO("[SEC] BLE Security module initialized (LESC enabled)");
    NRF_LOG_INFO("[SEC] Bonded peers: %d", get_bonded_peer_count());
}

/**
 * @brief Handle Peer Manager security events.
 *
 * Processes all PM events related to pairing, bonding, and encryption.
 * Dispatches application-level security events via the registered callback.
 */
void HZM_BLE_Security::on_pm_evt(pm_evt_t const * p_evt)
{
    ret_code_t err_code;

    switch (p_evt->evt_id)
    {
        case PM_EVT_CONN_SEC_START:
        {
            // Pairing/encryption procedure has started
            m_security_state = HZM_SEC_STATE_ENCRYPTING;
            NRF_LOG_INFO("[SEC] Security procedure started (conn_handle: %d)",
                         p_evt->conn_handle);
            dispatch_event(HZM_SEC_EVT_PAIRING_STARTED,
                           p_evt->conn_handle,
                           p_evt->peer_id);
            break;
        }

        case PM_EVT_CONN_SEC_SUCCEEDED:
        {
            // Connection secured - encryption is now active
            pm_conn_sec_status_t conn_sec_status;
            err_code = pm_conn_sec_status_get(p_evt->conn_handle, &conn_sec_status);
            APP_ERROR_CHECK(err_code);

            m_security_state      = HZM_SEC_STATE_ENCRYPTED;
            m_current_peer_id     = p_evt->peer_id;
            m_current_conn_handle = p_evt->conn_handle;
            m_auth_failure_count  = 0; // Reset failure counter on success

            NRF_LOG_INFO("[SEC] Connection secured (peer_id: %d, encrypted: %d, MITM: %d, LESC: %d)",
                         p_evt->peer_id,
                         conn_sec_status.encrypted,
                         conn_sec_status.mitm_protected,
                         conn_sec_status.lesc);

            if (conn_sec_status.lesc)
            {
                NRF_LOG_INFO("[SEC] LESC pairing confirmed - medical-grade encryption active");
            }

            dispatch_event(HZM_SEC_EVT_ENCRYPTION_ESTABLISHED,
                           p_evt->conn_handle,
                           p_evt->peer_id);
            break;
        }

        case PM_EVT_CONN_SEC_FAILED:
        {
            // Pairing/encryption failed
            m_security_state = HZM_SEC_STATE_PAIRING_FAILED;
            m_auth_failure_count++;

            NRF_LOG_WARNING("[SEC] Security procedure FAILED (peer_id: %d, error: 0x%04X, failures: %d/%d)",
                            p_evt->peer_id,
                            p_evt->params.conn_sec_failed.error,
                            m_auth_failure_count,
                            MAX_AUTH_FAILURES);

            dispatch_event(HZM_SEC_EVT_PAIRING_FAILED,
                           p_evt->conn_handle,
                           p_evt->peer_id);

            // Disconnect if too many consecutive failures (brute-force protection)
            if (m_auth_failure_count >= MAX_AUTH_FAILURES)
            {
                NRF_LOG_ERROR("[SEC] Max auth failures reached - disconnecting device");
                err_code = sd_ble_gap_disconnect(p_evt->conn_handle,
                                                 BLE_HCI_AUTHENTICATION_FAILURE);
                if (err_code != NRF_ERROR_INVALID_STATE)
                {
                    APP_ERROR_CHECK(err_code);
                }
            }
            break;
        }

        case PM_EVT_CONN_SEC_CONFIG_REQ:
        {
            // A connected peer wants to pair. Allow pairing if under failure limit.
            pm_conn_sec_config_t conn_sec_config = {
                .allow_repairing = (m_auth_failure_count < MAX_AUTH_FAILURES)
            };
            pm_conn_sec_config_reply(p_evt->conn_handle, &conn_sec_config);

            NRF_LOG_INFO("[SEC] Pairing config request - repairing %s",
                         conn_sec_config.allow_repairing ? "ALLOWED" : "BLOCKED");
            break;
        }

        case PM_EVT_STORAGE_FULL:
        {
            // Flash storage full - run garbage collection
            NRF_LOG_WARNING("[SEC] Flash storage full - running garbage collection");
            err_code = fds_gc();
            if (err_code == FDS_ERR_NO_SPACE_IN_QUEUES)
            {
                // No space in FDS queues - will retry later
                NRF_LOG_WARNING("[SEC] FDS GC queues full, will retry");
            }
            else
            {
                APP_ERROR_CHECK(err_code);
            }
            break;
        }

        case PM_EVT_BONDED_PEER_CONNECTED:
        {
            // A previously bonded peer has reconnected
            m_current_peer_id = p_evt->peer_id;
            NRF_LOG_INFO("[SEC] Bonded peer reconnected (peer_id: %d)", p_evt->peer_id);

            dispatch_event(HZM_SEC_EVT_BONDED_PEER_CONNECTED,
                           p_evt->conn_handle,
                           p_evt->peer_id);
            break;
        }

        case PM_EVT_PEER_DATA_UPDATE_SUCCEEDED:
        {
            // Bond data successfully stored in flash
            if (p_evt->params.peer_data_update_succeeded.flash_changed)
            {
                NRF_LOG_INFO("[SEC] Bond data stored in flash (peer_id: %d, action: %d)",
                             p_evt->peer_id,
                             p_evt->params.peer_data_update_succeeded.action);
                dispatch_event(HZM_SEC_EVT_BONDING_STORED,
                               p_evt->conn_handle,
                               p_evt->peer_id);
            }
            break;
        }

        case PM_EVT_PEER_DATA_UPDATE_FAILED:
        {
            NRF_LOG_ERROR("[SEC] Failed to update peer data (peer_id: %d, error: 0x%04X)",
                          p_evt->peer_id,
                          p_evt->params.peer_data_update_failed.error);
            break;
        }

        case PM_EVT_PEER_DELETE_SUCCEEDED:
        {
            NRF_LOG_INFO("[SEC] Peer deleted (peer_id: %d)", p_evt->peer_id);
            break;
        }

        case PM_EVT_PEERS_DELETE_SUCCEEDED:
        {
            NRF_LOG_INFO("[SEC] All peers deleted");
            break;
        }

        case PM_EVT_LOCAL_DB_CACHE_APPLIED:
        {
            NRF_LOG_INFO("[SEC] Local DB cache applied for peer_id: %d", p_evt->peer_id);
            break;
        }

        case PM_EVT_LOCAL_DB_CACHE_APPLY_FAILED:
        {
            // Peer appears to have changed its database. Clearing the old cache.
            NRF_LOG_WARNING("[SEC] Local DB cache apply failed for peer_id: %d - clearing old cache",
                            p_evt->peer_id);
            err_code = pm_local_database_has_changed();
            if (err_code != NRF_ERROR_INVALID_STATE)
            {
                APP_ERROR_CHECK(err_code);
            }
            break;
        }

        case PM_EVT_SERVICE_CHANGED_IND_SENT:
        {
            NRF_LOG_INFO("[SEC] Service Changed indication sent to peer_id: %d",
                         p_evt->peer_id);
            break;
        }

        case PM_EVT_SERVICE_CHANGED_IND_CONFIRMED:
        {
            NRF_LOG_INFO("[SEC] Service Changed indication confirmed by peer_id: %d",
                         p_evt->peer_id);
            break;
        }

        default:
            break;
    }
}

/**
 * @brief Handle BLE GAP security-related events.
 *
 * Processes security parameter requests, authentication results,
 * connection security updates, and LESC DH key requests.
 */
void HZM_BLE_Security::on_ble_evt(ble_evt_t const * p_ble_evt)
{
    ret_code_t err_code;

    switch (p_ble_evt->header.evt_id)
    {
        case BLE_GAP_EVT_SEC_PARAMS_REQUEST:
        {
            // Peer is requesting security parameters.
            // The Peer Manager handles the response automatically via pm_sec_params_set(),
            // but we log the event for audit trail.
            NRF_LOG_INFO("[SEC] Security parameters requested by peer (conn_handle: %d)",
                         p_ble_evt->evt.gap_evt.conn_handle);
            break;
        }

        case BLE_GAP_EVT_AUTH_STATUS:
        {
            // Authentication procedure completed
            ble_gap_evt_auth_status_t const * p_auth = &p_ble_evt->evt.gap_evt.params.auth_status;

            NRF_LOG_INFO("[SEC] Auth status: bonded=%d, lesc=%d, MITM=%d, "
                         "auth_status=0x%02X, error_src=0x%02X",
                         p_auth->bonded,
                         p_auth->lesc,
                         p_auth->sm1_levels.lv3,  // MITM protected
                         p_auth->auth_status,
                         p_auth->error_src);

            if (p_auth->auth_status == BLE_GAP_SEC_STATUS_SUCCESS)
            {
                if (p_auth->bonded)
                {
                    NRF_LOG_INFO("[SEC] Pairing + Bonding successful (LESC: %s)",
                                 p_auth->lesc ? "YES" : "NO");
                    dispatch_event(HZM_SEC_EVT_PAIRING_SUCCESS,
                                   p_ble_evt->evt.gap_evt.conn_handle,
                                   m_current_peer_id);
                }
            }
            else
            {
                NRF_LOG_WARNING("[SEC] Authentication failed: status=0x%02X, source=0x%02X",
                                p_auth->auth_status, p_auth->error_src);
            }
            break;
        }

        case BLE_GAP_EVT_CONN_SEC_UPDATE:
        {
            // Connection security level has changed
            ble_gap_conn_sec_t const * p_conn_sec = &p_ble_evt->evt.gap_evt.params.conn_sec_update.conn_sec;

            NRF_LOG_INFO("[SEC] Connection security updated: "
                         "sec_mode=%d, level=%d (conn_handle: %d)",
                         p_conn_sec->sec_mode.sm,
                         p_conn_sec->sec_mode.lv,
                         p_ble_evt->evt.gap_evt.conn_handle);

            // Security Mode 1, Level 4 = LESC authenticated pairing with encryption
            // Security Mode 1, Level 3 = Authenticated pairing with encryption (legacy)
            // Security Mode 1, Level 2 = Unauthenticated pairing with encryption
            // Security Mode 1, Level 1 = No security (open)
            if (p_conn_sec->sec_mode.sm == 1 && p_conn_sec->sec_mode.lv >= 2)
            {
                m_security_state = HZM_SEC_STATE_ENCRYPTED;
                NRF_LOG_INFO("[SEC] Link ENCRYPTED - ECG data transmission authorized");
                dispatch_event(HZM_SEC_EVT_LINK_SECURED,
                               p_ble_evt->evt.gap_evt.conn_handle,
                               m_current_peer_id);
            }
            else
            {
                NRF_LOG_WARNING("[SEC] Insufficient security level - "
                                "ECG data transmission NOT authorized");
                dispatch_event(HZM_SEC_EVT_UNAUTHORIZED_ACCESS,
                               p_ble_evt->evt.gap_evt.conn_handle,
                               PM_PEER_ID_INVALID);
            }
            break;
        }

        case BLE_GAP_EVT_AUTH_KEY_REQUEST:
        {
            // Peer is requesting an authentication key (passkey/OOB).
            // For Just Works / Numeric Comparison with IO_CAPS_NONE, this is not expected.
            NRF_LOG_INFO("[SEC] Auth key requested (type: %d)",
                         p_ble_evt->evt.gap_evt.params.auth_key_request.key_type);
            break;
        }

        case BLE_GAP_EVT_PHY_UPDATE_REQUEST:
        {
            // Accept any PHY update request
            NRF_LOG_DEBUG("[SEC] PHY update request.");
            ble_gap_phys_t const phys = {
                .tx_phys = BLE_GAP_PHY_AUTO,
                .rx_phys = BLE_GAP_PHY_AUTO,
            };
            err_code = sd_ble_gap_phy_update(p_ble_evt->evt.gap_evt.conn_handle, &phys);
            APP_ERROR_CHECK(err_code);
            break;
        }

        default:
            break;
    }
}

/**
 * @brief Check if the BLE link is currently encrypted.
 */
bool HZM_BLE_Security::is_link_encrypted(uint16_t conn_handle)
{
    if (conn_handle == BLE_CONN_HANDLE_INVALID)
    {
        return false;
    }

    ble_gap_conn_sec_t conn_sec;
    ret_code_t err_code = sd_ble_gap_conn_sec_get(conn_handle, &conn_sec);

    if (err_code != NRF_SUCCESS)
    {
        return false;
    }

    // Mode 1, Level 2+ means encrypted
    return (conn_sec.sec_mode.sm == 1 && conn_sec.sec_mode.lv >= 2);
}

/**
 * @brief Request encryption on an active connection.
 *
 * For bonded peers, this restores encryption using stored LTK.
 * For new peers, this triggers a new LESC pairing procedure.
 */
void HZM_BLE_Security::request_encryption(uint16_t conn_handle)
{
    if (conn_handle == BLE_CONN_HANDLE_INVALID)
    {
        NRF_LOG_WARNING("[SEC] Cannot request encryption - no active connection");
        return;
    }

    ret_code_t err_code = pm_conn_secure(conn_handle, false);

    if (err_code == NRF_ERROR_BUSY)
    {
        NRF_LOG_INFO("[SEC] Security procedure already in progress");
    }
    else if (err_code == BLE_ERROR_INVALID_CONN_HANDLE)
    {
        NRF_LOG_WARNING("[SEC] Invalid connection handle for encryption request");
    }
    else if (err_code == NRF_ERROR_INVALID_STATE)
    {
        NRF_LOG_INFO("[SEC] Connection already secured or peer manager not initialized");
    }
    else
    {
        APP_ERROR_CHECK(err_code);
        NRF_LOG_INFO("[SEC] Encryption requested (conn_handle: %d)", conn_handle);
    }
}

/**
 * @brief Get the current security state.
 */
hzm_sec_state_t HZM_BLE_Security::get_security_state(void)
{
    return m_security_state;
}

/**
 * @brief Count the number of bonded peers in flash.
 */
uint32_t HZM_BLE_Security::get_bonded_peer_count(void)
{
    pm_peer_id_t peer_id;
    uint32_t     count = 0;

    peer_id = pm_next_peer_id_get(PM_PEER_ID_INVALID);
    while (peer_id != PM_PEER_ID_INVALID)
    {
        count++;
        peer_id = pm_next_peer_id_get(peer_id);
    }

    return count;
}

/**
 * @brief Check if a peer is authorized (bonded).
 *
 * For this medical device, only bonded peers are considered authorized.
 * This ensures that only devices that have completed the LESC pairing
 * process can access ECG data.
 */
bool HZM_BLE_Security::is_peer_authorized(pm_peer_id_t peer_id)
{
    if (peer_id == PM_PEER_ID_INVALID)
    {
        return false;
    }

    return validate_bonded_peer(peer_id);
}

/**
 * @brief Delete all bonds and reset security state.
 */
void HZM_BLE_Security::delete_all_bonds(void)
{
    ret_code_t err_code;

    NRF_LOG_INFO("[SEC] Deleting all bonds...");
    m_security_state     = HZM_SEC_STATE_DISCONNECTED;
    m_current_peer_id    = PM_PEER_ID_INVALID;
    m_auth_failure_count = 0;

    err_code = pm_peers_delete();
    APP_ERROR_CHECK(err_code);
}

// ============================================================================
// Private helpers
// ============================================================================

/**
 * @brief Dispatch a security event to the application callback.
 */
void HZM_BLE_Security::dispatch_event(hzm_sec_evt_type_t evt_type,
                                       uint16_t conn_handle,
                                       pm_peer_id_t peer_id)
{
    if (m_evt_handler != NULL)
    {
        hzm_sec_evt_t evt;
        evt.evt_type    = evt_type;
        evt.conn_handle = conn_handle;
        evt.peer_id     = peer_id;
        m_evt_handler(&evt);
    }
}

/**
 * @brief Validate that a peer ID exists in the bonded peer list.
 */
bool HZM_BLE_Security::validate_bonded_peer(pm_peer_id_t peer_id)
{
    pm_peer_id_t current_id = pm_next_peer_id_get(PM_PEER_ID_INVALID);

    while (current_id != PM_PEER_ID_INVALID)
    {
        if (current_id == peer_id)
        {
            return true;
        }
        current_id = pm_next_peer_id_get(current_id);
    }

    return false;
}
