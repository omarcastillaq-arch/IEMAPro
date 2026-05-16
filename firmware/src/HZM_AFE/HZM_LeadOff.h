// Copyright (c) 2022 Horizon Medical SAS. All Rights Reserved.
// Phase 14 - Automatic Lead-Off Detection for ADS1298.

#ifndef HZM_LEAD_OFF_H
#define HZM_LEAD_OFF_H

extern "C"
{
#include <stdint.h>
#include <stdbool.h>
}

/**
 * @defgroup HZM_LEAD_OFF Automatic Lead-Off Detection
 * @brief Detects disconnected electrodes using ADS1298 status register bits.
 *
 * The ADS1298 provides lead-off status in the 3-byte status word that
 * precedes channel data in each SPI frame (RDATAC mode):
 *
 *   Status byte layout (24 bits = 3 bytes):
 *   [23:20] = 1100 (fixed header)
 *   [19:16] = LOFF_STATP[7:4] (positive electrode status, channels 8-5)
 *   [15:12] = LOFF_STATP[3:0] (positive electrode status, channels 4-1)
 *   [11:8]  = LOFF_STATN[7:4] (negative electrode status, channels 8-5)
 *   [7:4]   = LOFF_STATN[3:0] (negative electrode status, channels 4-1)
 *   [3:0]   = GPIO[3:0]
 *
 * A '1' bit indicates the corresponding electrode is OFF (disconnected).
 *
 * Lead-off detection requires CONFIG3 and LOFF register configuration
 * on the ADS1298 (DC or AC excitation method).
 * @{
 */

/// Number of ECG channels on ADS1298
#define HZM_LEADOFF_NUM_CHANNELS    8

/// Debounce count: consecutive lead-off readings before flagging
#define HZM_LEADOFF_DEBOUNCE_COUNT  5

/// Lead-off status for a single channel
typedef struct {
    bool positive_off;      ///< Positive electrode disconnected
    bool negative_off;      ///< Negative electrode disconnected
    bool is_off;            ///< Either electrode disconnected (convenience)
} hzm_leadoff_channel_t;

/// Complete lead-off status
typedef struct {
    hzm_leadoff_channel_t channels[HZM_LEADOFF_NUM_CHANNELS];
    uint8_t  off_count;         ///< Number of channels with lead-off
    uint8_t  raw_statp;         ///< Raw LOFF_STATP byte from status
    uint8_t  raw_statn;         ///< Raw LOFF_STATN byte from status
    bool     any_off;           ///< True if any channel has lead-off
    bool     all_off;           ///< True if all channels have lead-off
} hzm_leadoff_status_t;

/// Event callback for lead-off state changes
typedef void (*hzm_leadoff_event_handler_t)(const hzm_leadoff_status_t *status);

/** @} */

class HZM_LeadOff
{
public:
    HZM_LeadOff();
    ~HZM_LeadOff();

    /**
     * @brief Initialize lead-off detection.
     * @param evt_handler Callback when lead-off state changes (can be NULL).
     */
    static void init(hzm_leadoff_event_handler_t evt_handler);

    /**
     * @brief Process a status word from ADS1298 SPI frame.
     * Call this for every data-ready interrupt with the 3 status bytes.
     * @param status_msb   Status byte 0 (MSB: header + LOFF_STATP high nibble)
     * @param status_mid   Status byte 1 (LOFF_STATP low nibble + LOFF_STATN high)
     * @param status_lsb   Status byte 2 (LOFF_STATN low nibble + GPIO)
     */
    static void process_status(uint8_t status_msb, uint8_t status_mid, uint8_t status_lsb);

    /**
     * @brief Get current (debounced) lead-off status.
     */
    static hzm_leadoff_status_t get_status(void);

    /**
     * @brief Check if a specific channel has lead-off.
     * @param channel Channel index 0-7.
     */
    static bool is_channel_off(uint8_t channel);

    /**
     * @brief Check if any electrode is disconnected.
     */
    static bool any_lead_off(void);

    /**
     * @brief Configure ADS1298 lead-off detection registers.
     * Sets up DC lead-off detection with configurable current magnitude.
     * Must be called during AFE configuration phase.
     */
    static void configure_ads1298_leadoff(void);

    /**
     * @brief Get a bitmask of channels with lead-off (bit 0 = ch1, etc).
     */
    static uint8_t get_off_bitmask(void);

private:
    static hzm_leadoff_status_t        m_status;
    static hzm_leadoff_event_handler_t m_evt_handler;
    static uint8_t                     m_debounce_p[HZM_LEADOFF_NUM_CHANNELS];
    static uint8_t                     m_debounce_n[HZM_LEADOFF_NUM_CHANNELS];
    static bool                        m_initialized;
    static hzm_leadoff_status_t        m_prev_status;

    /**
     * @brief Parse raw status bytes into channel-level lead-off info.
     */
    static void parse_status_bits(uint8_t statp, uint8_t statn);

    /**
     * @brief Apply debouncing to prevent spurious lead-off alerts.
     */
    static void apply_debounce(uint8_t raw_statp, uint8_t raw_statn);
};

#endif // HZM_LEAD_OFF_H
