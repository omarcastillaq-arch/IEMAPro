// Copyright (c) 2022 Horizon Medical SAS. All Rights Reserved.
// Phase 14 - Automatic Lead-Off Detection Implementation.

extern "C"
{
#include "nrf_log.h"
#include "nrf_log_ctrl.h"
#include <string.h>
}
#include "HZM_LeadOff.h"
#include "HZM_Log.h"

// Static member initialization
hzm_leadoff_status_t        HZM_LeadOff::m_status = {0};
hzm_leadoff_event_handler_t HZM_LeadOff::m_evt_handler = NULL;
uint8_t                     HZM_LeadOff::m_debounce_p[HZM_LEADOFF_NUM_CHANNELS] = {0};
uint8_t                     HZM_LeadOff::m_debounce_n[HZM_LEADOFF_NUM_CHANNELS] = {0};
bool                        HZM_LeadOff::m_initialized = false;
hzm_leadoff_status_t        HZM_LeadOff::m_prev_status = {0};

HZM_LeadOff::HZM_LeadOff() {}
HZM_LeadOff::~HZM_LeadOff() {}

void HZM_LeadOff::init(hzm_leadoff_event_handler_t evt_handler)
{
    m_evt_handler = evt_handler;
    memset(&m_status, 0, sizeof(m_status));
    memset(&m_prev_status, 0, sizeof(m_prev_status));
    memset(m_debounce_p, 0, sizeof(m_debounce_p));
    memset(m_debounce_n, 0, sizeof(m_debounce_n));
    m_initialized = true;

    hz_log("[LEADOFF] Lead-off detection initialized (debounce=%d)",
           HZM_LEADOFF_DEBOUNCE_COUNT);
}

void HZM_LeadOff::process_status(uint8_t status_msb, uint8_t status_mid, uint8_t status_lsb)
{
    if (!m_initialized) return;

    /**
     * ADS1298 Status register (24-bit) in RDATAC mode:
     *
     * Byte 0 (MSB):  [1100 | LOFF_STATP[7:4]]
     *   bits 7-4: fixed header 0xC (1100)
     *   bits 3-0: LOFF_STATP for channels 8,7,6,5
     *
     * Byte 1 (MID):  [LOFF_STATP[3:0] | LOFF_STATN[7:4]]
     *   bits 7-4: LOFF_STATP for channels 4,3,2,1
     *   bits 3-0: LOFF_STATN for channels 8,7,6,5
     *
     * Byte 2 (LSB):  [LOFF_STATN[3:0] | GPIO[3:0]]
     *   bits 7-4: LOFF_STATN for channels 4,3,2,1
     *   bits 3-0: GPIO status
     */

    // Extract LOFF_STATP (8 bits: channels 8 downto 1)
    uint8_t loff_statp = ((status_msb & 0x0F) << 4) | ((status_mid & 0xF0) >> 4);

    // Extract LOFF_STATN (8 bits: channels 8 downto 1)
    uint8_t loff_statn = ((status_mid & 0x0F) << 4) | ((status_lsb & 0xF0) >> 4);

    // Apply debouncing and update status
    apply_debounce(loff_statp, loff_statn);
}

void HZM_LeadOff::apply_debounce(uint8_t raw_statp, uint8_t raw_statn)
{
    bool state_changed = false;

    for (uint8_t ch = 0; ch < HZM_LEADOFF_NUM_CHANNELS; ch++)
    {
        // Bit order: bit 7 = channel 8, bit 0 = channel 1
        // We map: channel index 0 → bit 0 (channel 1)
        uint8_t mask = (1 << ch);

        bool p_raw = (raw_statp & mask) != 0;
        bool n_raw = (raw_statn & mask) != 0;

        // Debounce positive electrode
        if (p_raw)
        {
            if (m_debounce_p[ch] < HZM_LEADOFF_DEBOUNCE_COUNT)
                m_debounce_p[ch]++;
        }
        else
        {
            if (m_debounce_p[ch] > 0)
                m_debounce_p[ch]--;
        }

        // Debounce negative electrode
        if (n_raw)
        {
            if (m_debounce_n[ch] < HZM_LEADOFF_DEBOUNCE_COUNT)
                m_debounce_n[ch]++;
        }
        else
        {
            if (m_debounce_n[ch] > 0)
                m_debounce_n[ch]--;
        }

        // Update channel status based on debounced values
        bool new_p_off = (m_debounce_p[ch] >= HZM_LEADOFF_DEBOUNCE_COUNT);
        bool new_n_off = (m_debounce_n[ch] >= HZM_LEADOFF_DEBOUNCE_COUNT);

        // Detect state change
        if (new_p_off != m_status.channels[ch].positive_off ||
            new_n_off != m_status.channels[ch].negative_off)
        {
            state_changed = true;
        }

        m_status.channels[ch].positive_off = new_p_off;
        m_status.channels[ch].negative_off = new_n_off;
        m_status.channels[ch].is_off = new_p_off || new_n_off;
    }

    // Update aggregate status
    m_status.raw_statp = raw_statp;
    m_status.raw_statn = raw_statn;
    m_status.off_count = 0;
    m_status.any_off = false;
    m_status.all_off = true;

    for (uint8_t ch = 0; ch < HZM_LEADOFF_NUM_CHANNELS; ch++)
    {
        if (m_status.channels[ch].is_off)
        {
            m_status.off_count++;
            m_status.any_off = true;
        }
        else
        {
            m_status.all_off = false;
        }
    }

    if (m_status.off_count == 0) m_status.all_off = false;

    // Notify on state change
    if (state_changed)
    {
        NRF_LOG_INFO("[LEADOFF] State changed: %d channels off (STATP=0x%02X STATN=0x%02X)",
                     m_status.off_count, raw_statp, raw_statn);

        if (m_evt_handler != NULL)
        {
            m_evt_handler(&m_status);
        }
    }
}

hzm_leadoff_status_t HZM_LeadOff::get_status(void)
{
    return m_status;
}

bool HZM_LeadOff::is_channel_off(uint8_t channel)
{
    if (channel >= HZM_LEADOFF_NUM_CHANNELS) return true;
    return m_status.channels[channel].is_off;
}

bool HZM_LeadOff::any_lead_off(void)
{
    return m_status.any_off;
}

uint8_t HZM_LeadOff::get_off_bitmask(void)
{
    uint8_t mask = 0;
    for (uint8_t ch = 0; ch < HZM_LEADOFF_NUM_CHANNELS; ch++)
    {
        if (m_status.channels[ch].is_off)
            mask |= (1 << ch);
    }
    return mask;
}

void HZM_LeadOff::configure_ads1298_leadoff(void)
{
    /**
     * ADS1298 Lead-Off Detection Configuration:
     *
     * LOFF register (0x04):
     *   [7:5] COMP_TH = 000 (comparator threshold: positive 95%, negative 5%)
     *   [4]   reserved = 0
     *   [3:2] ILEAD_OFF = 01 (6 nA lead-off current)
     *   [1:0] FLEAD_OFF = 01 (DC lead-off detection)
     *   → Value: 0x05
     *
     * CONFIG3 register (0x03):
     *   bit 1: PD_LOFF_COMP = 1 (Lead-off comparator enabled)
     *   → OR existing CONFIG3 value with 0x02
     *
     * LOFF_SENSP (0x0F): 0xFF (enable P-side detection all channels)
     * LOFF_SENSN (0x10): 0xFF (enable N-side detection all channels)
     *
     * Note: Actual SPI writes are deferred to HZM_AFE::configure()
     * integration. This method documents the required register values.
     */
    hz_log("[LEADOFF] ADS1298 lead-off config: LOFF=0x05, SENSP=0xFF, SENSN=0xFF");

    // The actual SPI register writes should be integrated into
    // HZM_AFE::configure() by extending the command array:
    //   LOFF register (addr 0x04) = 0x05
    //   LOFF_SENSP (addr 0x0F) = 0xFF
    //   LOFF_SENSN (addr 0x10) = 0xFF
    //   CONFIG3 (addr 0x03) |= 0x02
}
