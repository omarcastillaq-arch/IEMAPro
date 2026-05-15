extern "C"
{
#include "ble.h"
}
#include "HZM_BLE_Service.h"
#include "HZM_BLE_Security.h"

class HZM_BLE
{
public:
        HZM_BLE();
        static void timers_init(void);
        static void ble_stack_init(void);
        static void gap_params_init(void);
        static void ble_evt_handler(ble_evt_t const *p_ble_evt, void *p_context);
        static void gatt_init(void);
        static void advertising_init(void);
        static void services_init(void);
        static void conn_params_init(void);
        static void peer_manager_init(void);
        static void advertising_start(bool erase_bonds);
        static void on_connect(hz_ecgs_t *p_ecgs, ble_evt_t const *p_ble_evt);
        static void send_data_over_BLE();
        static void hz_send_ecg_channel(ble_gatts_char_handles_t handle, uint8_t *data);

        /**
         * @brief Initialize the BLE security subsystem (LESC + bonding).
         * Must be called after peer_manager_init() and before advertising_start().
         */
        static void security_init(void);

        /**
         * @brief Check if the current BLE link is encrypted.
         * Used to gate ECG data transmission - data is only sent on encrypted links.
         * @return true if link is encrypted.
         */
        static bool is_link_secure(void);
};
