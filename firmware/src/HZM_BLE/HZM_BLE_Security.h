/**
 * @file HZM_BLE_Security.h
 * @brief BLE Security Module for Horizon Medical IoT Holter
 *
 * Implements LE Secure Connections (LESC), bonding management,
 * authorized device validation, and security event handling
 * for HIPAA-compliant medical data transmission.
 *
 * @copyright Copyright (c) 2024 Horizon Medical
 */

#ifndef HZM_BLE_SECURITY_H
#define HZM_BLE_SECURITY_H

extern "C"
{
#include <stdint.h>
#include <stdbool.h>
#include "ble.h"
#include "peer_manager.h"
#include "peer_manager_handler.h"
#include "nrf_ble_lesc.h"
}

/**
 * @brief Maximum number of authorized devices that can be stored.
 *
 * Limits the whitelist to prevent unbounded memory usage on the nRF52.
 * For a medical device, typically only a few trusted central devices
 * (phone app, gateway) need to connect.
 */
#define HZM_SEC_MAX_AUTHORIZED_DEVICES  8

/**
 * @brief Security states for the BLE connection.
 */
typedef enum
{
    HZM_SEC_STATE_DISCONNECTED = 0,     /**< No active connection */
    HZM_SEC_STATE_CONNECTED,            /**< Connected but not encrypted */
    HZM_SEC_STATE_ENCRYPTING,           /**< Encryption/pairing in progress */
    HZM_SEC_STATE_ENCRYPTED,            /**< Link encrypted (bonded or paired) */
    HZM_SEC_STATE_PAIRING_FAILED,       /**< Pairing attempt failed */
} hzm_sec_state_t;

/**
 * @brief Security event types for application-level callbacks.
 */
typedef enum
{
    HZM_SEC_EVT_PAIRING_STARTED = 0,    /**< Pairing procedure started */
    HZM_SEC_EVT_PAIRING_SUCCESS,        /**< Pairing completed successfully */
    HZM_SEC_EVT_PAIRING_FAILED,         /**< Pairing failed */
    HZM_SEC_EVT_ENCRYPTION_ESTABLISHED, /**< Link encryption established */
    HZM_SEC_EVT_BONDING_STORED,         /**< Bond information stored in flash */
    HZM_SEC_EVT_BONDED_PEER_CONNECTED,  /**< A previously bonded peer reconnected */
    HZM_SEC_EVT_UNAUTHORIZED_ACCESS,    /**< Unauthorized device attempted access */
    HZM_SEC_EVT_LINK_SECURED,           /**< Link fully secured (encrypted + authenticated) */
} hzm_sec_evt_type_t;

/**
 * @brief Security event structure passed to the application callback.
 */
typedef struct
{
    hzm_sec_evt_type_t evt_type;    /**< Type of security event */
    uint16_t           conn_handle; /**< Connection handle */
    pm_peer_id_t       peer_id;     /**< Peer Manager peer ID (if applicable) */
} hzm_sec_evt_t;

/**
 * @brief Application callback for security events.
 */
typedef void (*hzm_sec_evt_handler_t)(hzm_sec_evt_t const * p_evt);

/**
 * @brief BLE Security management class for Horizon Medical Holter.
 *
 * Provides LESC pairing, bonding persistence, authorized device
 * whitelist management, and security event dispatching.
 */
class HZM_BLE_Security
{
public:
    /**
     * @brief Initialize the BLE security module.
     *
     * Sets up LESC key generation, security parameters, and
     * registers the Peer Manager event handler for security events.
     * Must be called after HZM_BLE::ble_stack_init() and before
     * HZM_BLE::advertising_start().
     *
     * @param[in] evt_handler  Optional callback for security events.
     *                         Pass NULL if not needed.
     */
    static void init(hzm_sec_evt_handler_t evt_handler);

    /**
     * @brief Handle Peer Manager events related to security.
     *
     * Should be called from the main pm_evt_handler to process
     * pairing, bonding, and encryption events.
     *
     * @param[in] p_evt  Pointer to Peer Manager event.
     */
    static void on_pm_evt(pm_evt_t const * p_evt);

    /**
     * @brief Handle BLE GAP security events.
     *
     * Processes BLE_GAP_EVT_SEC_PARAMS_REQUEST, BLE_GAP_EVT_AUTH_STATUS,
     * BLE_GAP_EVT_CONN_SEC_UPDATE, BLE_GAP_EVT_AUTH_KEY_REQUEST, and
     * BLE_GAP_EVT_LESC_DHKEY_REQUEST events.
     *
     * @param[in] p_ble_evt  Pointer to BLE event.
     */
    static void on_ble_evt(ble_evt_t const * p_ble_evt);

    /**
     * @brief Check if the current connection is encrypted.
     *
     * @param[in] conn_handle  Connection handle to check.
     * @return true if the link is encrypted, false otherwise.
     */
    static bool is_link_encrypted(uint16_t conn_handle);

    /**
     * @brief Request encryption on an existing connection.
     *
     * If the peer is bonded, restores encryption using stored keys.
     * Otherwise, initiates a new pairing procedure.
     *
     * @param[in] conn_handle  Connection handle.
     */
    static void request_encryption(uint16_t conn_handle);

    /**
     * @brief Get the current security state.
     *
     * @return Current security state enum value.
     */
    static hzm_sec_state_t get_security_state(void);

    /**
     * @brief Get the number of currently bonded peers.
     *
     * @return Count of bonded peers stored in flash.
     */
    static uint32_t get_bonded_peer_count(void);

    /**
     * @brief Check if a peer ID corresponds to an authorized device.
     *
     * @param[in] peer_id  Peer Manager peer ID to validate.
     * @return true if the peer is in the authorized device list.
     */
    static bool is_peer_authorized(pm_peer_id_t peer_id);

    /**
     * @brief Delete all bond information and reset security state.
     */
    static void delete_all_bonds(void);

private:
    static hzm_sec_state_t       m_security_state;     /**< Current security state */
    static hzm_sec_evt_handler_t m_evt_handler;         /**< Application event handler */
    static uint16_t              m_current_conn_handle; /**< Current connection handle */
    static pm_peer_id_t          m_current_peer_id;     /**< Current peer ID */
    static uint32_t              m_auth_failure_count;   /**< Consecutive auth failure counter */

    /**
     * @brief Maximum consecutive auth failures before blocking.
     */
    static const uint32_t MAX_AUTH_FAILURES = 3;

    /**
     * @brief Dispatch a security event to the application callback.
     */
    static void dispatch_event(hzm_sec_evt_type_t evt_type,
                               uint16_t conn_handle,
                               pm_peer_id_t peer_id);

    /**
     * @brief Validate peer against bonded device list.
     */
    static bool validate_bonded_peer(pm_peer_id_t peer_id);
};

#endif // HZM_BLE_SECURITY_H
