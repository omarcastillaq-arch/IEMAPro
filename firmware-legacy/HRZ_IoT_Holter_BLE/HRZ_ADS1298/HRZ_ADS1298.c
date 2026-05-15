/* Copyright (c) 2017 Horizon Medical SAS, Cartagena - Colombia.
 * All Rights Reserved.
 *
 * Phase 3 Refactoring Summary:
 * ============================================================================
 * 1. ELIMINATED CODE DUPLICATION:
 *    - 24 individual channel arrays → 1 hrz_ecg_channels_t struct with 2D arrays
 *    - 8 identical hrz_get_sample_from_buffer() calls → 1 loop
 *    - 8 identical hrz_send_ecg_channel() calls → 1 loop (×3 functions)
 *    - 8 identical hrz_ads1298_filter_data() calls → 1 loop
 *    Code reduction: ~120 lines of repetitive code → ~30 lines of loop code
 *
 * 2. ENCAPSULATED GLOBAL STATE:
 *    - 4 scattered global booleans → hrz_ads1298_state_t struct
 *    - sample_count moved from static local to state struct (observable)
 *    - Backward-compatible macros maintain existing callers
 *
 * 3. IMPROVED ERROR HANDLING:
 *    - Channel validation in conversion functions
 *    - Error logging with channel identification
 *    - hrz_ads1298_error_t enum for structured error codes
 *
 * 4. BLE PROTOCOL COMPATIBILITY:
 *    - No changes to data format, packet size, or transmission order
 *    - Channels still sent in order 1-8 with same handle mapping
 *    - m_ecgs.ecg_channel_handles[ch] maps to same UUIDs (0x8171-0x8178)
 * ============================================================================
 */

#include "HRZ_ADS1298.h"
#include "HRZ_ecg_service.h"
#include "HRZ_ble.h"
#include "HRZ_ADS1298_LP_Filter.h"

#define NRF_LOG_MODULE_NAME "ADS1298"
#include "nrf_log.h"
#include "nrf_log_ctrl.h"
#include "nrf_delay.h"

/* ============================================================================
 * Private Data (module-scoped)
 * ============================================================================ */

/** @brief SPI TX/RX buffers for ADS1298 communication */
static uint8_t spi_tx_buffer[ADS1298_SPI_BUFFER_SIZE];
static uint8_t spi_rx_buffer[ADS1298_SPI_BUFFER_SIZE];

/** @brief Pointer to parsed ADS1298 data (legacy, kept for reference) */
hrz_ads1298_data_t *ads1298_data;

/* ============================================================================
 * Encapsulated State (replaces scattered globals)
 *
 * Before refactoring:
 *   bool ads1298_data_ready = false;     // global
 *   bool ads1298_data_received = false;  // global
 *   bool ads1298_configured = false;     // global
 *   bool ble_packet_ready = false;       // global
 *   static size_t sample_count = 0;      // hidden static local
 *
 * After refactoring: single state struct, observable and testable.
 * Legacy macros in .h file map old names to this struct.
 * ============================================================================ */
hrz_ads1298_state_t g_ads1298_state = {
    .data_ready      = false,
    .data_received   = false,
    .configured      = false,
    .ble_packet_ready = false,
    .sample_count    = 0
};

/* ============================================================================
 * ECG Channel Buffers (replaces 24 individual arrays)
 *
 * Before refactoring (24 arrays, 48 lines):
 *   static q31_t hrz_channel1[HRZ_SAMPLES_PER_PACKET];
 *   static q31_t hrz_channel2[HRZ_SAMPLES_PER_PACKET];
 *   ... (×8)
 *   static hrz_channel_data_t hrz_channel1_raw[HRZ_SAMPLES_PER_PACKET];
 *   ... (×8)
 *   static q31_t hrz_filtered_channel1[HRZ_SAMPLES_PER_PACKET];
 *   ... (×8)
 *
 * After refactoring: 1 struct with 3 two-dimensional arrays.
 * Access: g_channels.raw[ch][sample], g_channels.q31[ch][sample], etc.
 * ============================================================================ */
static hrz_ecg_channels_t g_channels;


/* ============================================================================
 * State Accessor
 * ============================================================================ */

/**@brief Get pointer to the ADS1298 device state.
 * Allows other modules to inspect state without global variable access.
 */
hrz_ads1298_state_t * hrz_ads1298_get_state(void)
{
    return &g_ads1298_state;
}


/* ============================================================================
 * SPI and Hardware Initialization
 * ============================================================================ */

/**@brief ADS1298 SPI Module initialization.
 * Configures SPI pins, frequency (500kHz), and mode (CPOL=0, CPHA=1).
 */
void hrz_ads1298_spi_init(void)
{
    nrf_drv_spi_config_t ads1298_spi_config = NRF_DRV_SPI_DEFAULT_CONFIG;
    ads1298_spi_config.miso_pin  = ADS1298_SPI_MISO_PIN;
    ads1298_spi_config.mosi_pin  = ADS1298_SPI_MOSI_PIN;
    ads1298_spi_config.sck_pin   = ADS1298_SPI_SCK_PIN;
    ads1298_spi_config.frequency = SPI_FREQUENCY_FREQUENCY_K500;
    ads1298_spi_config.mode      = NRF_SPI_MODE_1;

    APP_ERROR_CHECK(nrf_drv_spi_init(&ads1298_spi, &ads1298_spi_config,
                                     hrz_ads1298_spi_event_handler, NULL));
    nrf_gpio_cfg_output(ADS1298_SPI_SS_PIN);
    ADS1298_DESELECT();
    NRF_LOG_INFO("ADS SPI configured\r\n");
}

/**@brief ADS1298 SPI event handler.
 * Called by the SPI driver when a transfer completes.
 * Only flags data as received when connected and configured.
 */
void hrz_ads1298_spi_event_handler(nrf_drv_spi_evt_t const * p_event, void * p_context)
{
    spi_xfer_done = true;

    /* Only process data when BLE is connected and ADS1298 is configured */
    if (m_ecgs.conn_handle != BLE_CONN_HANDLE_INVALID && g_ads1298_state.configured)
    {
        g_ads1298_state.data_received = true;
        NRF_LOG_HEXDUMP_INFO(spi_rx_buffer, ADS1298_SPI_BUFFER_SIZE);
    }
}

/**@brief Configure ADS1298 DRDY pin for interrupt on falling edge.
 * The DRDY pin goes low when new conversion data is available.
 */
void hrz_ads1298_int_init(void)
{
    ret_code_t err_code;

    nrf_drv_gpiote_in_config_t in_config = GPIOTE_CONFIG_IN_SENSE_HITOLO(true);
    in_config.pull = NRF_GPIO_PIN_PULLUP;

    err_code = nrf_drv_gpiote_in_init(ADS1298_DRDY, &in_config, hrz_ads1298_int_pin_handler);
    APP_ERROR_CHECK(err_code);
    nrf_drv_gpiote_in_event_enable(ADS1298_DRDY, true);
    NRF_LOG_INFO("Interrupt configured\r\n");
}

/**@brief Start ADS1298 data conversion. */
void hrz_start_ads1298(void)
{
    nrf_gpio_pin_set(ADS1298_START);
}

/**@brief Stop ADS1298 data conversion. */
void hrz_stop_ads1298(void)
{
    nrf_gpio_pin_clear(ADS1298_START);
}

/**@brief External DRDY interrupt handler.
 * Sets data_ready flag; actual data read happens in main loop.
 */
void hrz_ads1298_int_pin_handler(nrf_drv_gpiote_pin_t pin, nrf_gpiote_polarity_t action)
{
    g_ads1298_state.data_ready = true;
}


/* ============================================================================
 * ADS1298 Configuration
 * ============================================================================ */

/**@brief Full ADS1298 initialization routine.
 *
 * Sequence: SPI init → interrupt init → power up → reset → configure
 * registers → enable WCT → set read data continuous mode.
 * Timing delays per ADS1298 datasheet specifications.
 */
void hrz_ads1298_init(void)
{
    NRF_LOG_INFO("Initializing ADS1298...\r\n");
    hrz_ads1298_spi_init();
    hrz_ads1298_int_init();

    /* Configure control GPIO pins */
    nrf_gpio_cfg_output(ADS1298_PWDN);
    nrf_gpio_cfg_output(ADS1298_RESET);
    nrf_gpio_cfg_output(ADS1298_START);

    /* Power up sequence */
    nrf_gpio_pin_clear(ADS1298_START);  /* Do not start yet */
    nrf_gpio_pin_set(ADS1298_PWDN);
    nrf_gpio_pin_set(ADS1298_RESET);

    /* Wait tPOR = tCLK × 2^18 ≈ 135ms (datasheet p96, max tCLK = 514ns) */
    nrf_delay_ms(135);

    /* Issue reset pulse: 2 × tCLK ≈ 2µs (datasheet p96) */
    nrf_gpio_pin_clear(ADS1298_RESET);
    nrf_delay_us(2);
    nrf_gpio_pin_set(ADS1298_RESET);

    /* Wait 16 × tCLK ≈ 9µs (datasheet p96) */
    nrf_delay_us(9);
    NRF_LOG_INFO("ADS1298 Initialized\r\n");

    /* Device wakes up in Read Data Continuous mode.
     * Send SDATAC to allow register writes. */
    uint8_t sdatac = ADS1298_SDATACC;
    hrz_ads1298_spi_txrx(&sdatac, 1, 0);
    nrf_delay_ms(200);

    /* Read device ID register */
    uint8_t readID[2] = { 0x20, 0x00 };
    hrz_ads1298_spi_txrx(readID, sizeof(readID), 3);

    /* Write registers CONFIG1 through CH8SET:
     * {opcode1, opcode2, CONFIG1, ..., CH8SET}
     * 0x60 = normal input, gain 12 for all channels */
    uint8_t command[14] = {
        0x41, 0x0B,       /* Write 12 registers starting at 0x01 */
        0x46, 0x10, 0xCE, /* CONFIG1, CONFIG2, CONFIG3 */
        0x00,             /* LOFF */
        0x60, 0x60, 0x60, 0x60, /* CH1SET-CH4SET: normal input, gain 12 */
        0x60, 0x60, 0x60, 0x60  /* CH5SET-CH8SET: normal input, gain 12 */
    };
    hrz_ads1298_spi_txrx(command, sizeof(command), 0);

    nrf_delay_ms(10);

    /* Enable Wilson Central Terminal (WCT):
     * Write WCT registers starting from address 0x18.
     * CH1- → WCTA (RA), CH1+ → WCTB (LA), CH2+ → WCTC (LL) */
    uint8_t wct[4] = {(0x40 | 0x18), 0x01, 0x09, 0xC2};
    hrz_ads1298_spi_txrx(wct, sizeof(wct), 0);

    /* Read back registers for verification */
    uint8_t readRegs[2] = { 0x21, 0x0B };
    hrz_ads1298_spi_txrx(readRegs, sizeof(readRegs), 14);

    /* Enable Read Data Continuous mode */
    uint8_t rdatac = ADS1298_RDATACC;
    hrz_ads1298_spi_txrx(&rdatac, 1, 0);

    /* Don't start yet - will start on BLE connect */
    hrz_stop_ads1298();

    g_ads1298_state.configured = true;
    g_ads1298_state.sample_count = 0;
    NRF_LOG_INFO("ADS1298 configuration complete\r\n");
}


/* ============================================================================
 * SPI Communication
 * ============================================================================ */

/**@brief ADS1298 SPI transmit/receive function.
 *
 * @param tx_buf  TX buffer
 * @param tx_len  TX buffer length
 * @param rx_len  RX buffer length
 */
void hrz_ads1298_spi_txrx(uint8_t * tx_buf, uint8_t tx_len, uint8_t rx_len)
{
    /* Reset RX buffer and transfer done flag */
    memset(spi_rx_buffer, 0, ADS1298_SPI_BUFFER_SIZE);
    spi_xfer_done = false;

    /* Perform SPI transfer */
    ADS1298_SELECT();
    APP_ERROR_CHECK(nrf_drv_spi_transfer(&ads1298_spi, tx_buf, tx_len, spi_rx_buffer, rx_len));

    /* Wait for SPI transfer to complete */
    while (!spi_xfer_done)
    {
        __WFE();
    }
    ADS1298_DESELECT();
}


/* ============================================================================
 * Data Conversion Utilities
 * ============================================================================ */

/**@brief Convert a 24-bit two's complement sample to a 32-bit signed integer.
 *
 * @param buffer   SPI receive buffer (27 bytes: 3 status + 24 data)
 * @param channel  Channel number (1-8)
 * @return         Converted q31 value, or -1 on invalid channel
 */
q31_t hrz_convert_24bit_twos_complement_to_int(uint8_t *buffer, uint8_t channel)
{
    if (channel < 1 || channel > ADS1298_NUM_CHANNELS)
    {
        NRF_LOG_ERROR("Invalid channel %d. Must be 1-%d\r\n", channel, ADS1298_NUM_CHANNELS);
        return -1;
    }

    /* Skip 3 status bytes; each channel occupies 3 bytes */
    uint8_t offset = channel * 3;
    q31_t result = ((buffer[offset] << 24) |
                    (buffer[offset + 1] << 16) |
                    (buffer[offset + 2] << 8)) >> 8;
    return result;
}

/**@brief Extract a raw 3-byte sample from the SPI buffer for a given channel.
 *
 * @param buffer   SPI receive buffer
 * @param channel  Channel number (1-8)
 * @return         hrz_channel_data_t with the 3 raw bytes
 */
hrz_channel_data_t hrz_get_sample_from_buffer(uint8_t *buffer, uint8_t channel)
{
    uint8_t offset = channel * 3;
    hrz_channel_data_t result;
    result.b1 = buffer[offset];
    result.b2 = buffer[offset + 1];
    result.b3 = buffer[offset + 2];
    NRF_LOG_HEXDUMP_INFO(buffer, ADS1298_SPI_BUFFER_SIZE);
    NRF_LOG_HEXDUMP_INFO((uint8_t*)&result, 3);
    return result;
}


/* ============================================================================
 * Data Acquisition
 * ============================================================================ */

/**@brief Receive and process one sample from all 8 ADS1298 channels.
 *
 * Refactored: Previously had 8 identical lines per function call.
 * Now uses a single loop over ADS1298_NUM_CHANNELS.
 * Data is stored in g_channels.raw[ch][sample_count].
 *
 * When HRZ_SAMPLES_PER_PACKET samples have been collected,
 * sets ble_packet_ready flag for BLE transmission.
 */
void hrz_get_ads1298_data(void)
{
    hrz_ads1298_spi_txrx(spi_tx_buffer, 0, ADS1298_SPI_BUFFER_SIZE);

    /* Wait for SPI event handler to flag data received */
    while (!g_ads1298_state.data_received);
    g_ads1298_state.data_received = false;

    /* Store each channel's sample in the corresponding buffer.
     * Refactored: 8 individual calls → 1 loop */
    for (uint8_t ch = 0; ch < ADS1298_NUM_CHANNELS; ch++)
    {
        g_channels.raw[ch][g_ads1298_state.sample_count] =
            hrz_get_sample_from_buffer(spi_rx_buffer, ch + 1);  /* channels are 1-indexed */
    }

    g_ads1298_state.sample_count++;

    /* Check if packet buffer is full */
    if (g_ads1298_state.sample_count >= HRZ_SAMPLES_PER_PACKET)
    {
        g_ads1298_state.sample_count = 0;
        g_ads1298_state.ble_packet_ready = true;
    }
}


/* ============================================================================
 * Signal Processing
 * ============================================================================ */

/**@brief Apply FIR low-pass filter to all 8 channels.
 *
 * Refactored: 8 identical filter calls → 1 loop.
 * Uses g_channels.q31[] as input and g_channels.filtered[] as output.
 *
 * @return  ARM_MATH_SUCCESS on success, or last error code on failure.
 */
arm_status hrz_filter_data(void)
{
    arm_status error_code = ARM_MATH_SUCCESS;
    arm_status last_error = ARM_MATH_SUCCESS;

    for (uint8_t ch = 0; ch < ADS1298_NUM_CHANNELS; ch++)
    {
        error_code = hrz_ads1298_filter_data(g_channels.q31[ch], g_channels.filtered[ch]);
        if (error_code != ARM_MATH_SUCCESS)
        {
            NRF_LOG_ERROR("Filter failed on channel %d, error: %d\r\n", ch + 1, error_code);
            last_error = error_code;
        }
    }

    return last_error;
}


/* ============================================================================
 * BLE Data Transmission
 * ============================================================================ */

/**@brief Send raw (unfiltered) data from all 8 channels over BLE.
 *
 * Refactored: 8 identical send calls → 1 loop.
 * Sends channels in order 1-8 using the same handle mapping
 * (m_ecgs.ecg_channel_handles[0-7] → UUIDs 0x8171-0x8178).
 */
void hrz_send_data_over_BLE(void)
{
    for (uint8_t ch = 0; ch < ADS1298_NUM_CHANNELS; ch++)
    {
        hrz_send_ecg_channel(m_ecgs.ecg_channel_handles[ch],
                             (uint8_t *)g_channels.raw[ch]);
    }
    g_ads1298_state.ble_packet_ready = false;
}

/**@brief Send filtered data from all 8 channels over BLE.
 *
 * Refactored: 8 identical send calls → 1 loop.
 * Same channel ordering and handle mapping as hrz_send_data_over_BLE().
 */
void hrz_send_filtered_data_over_BLE(void)
{
    for (uint8_t ch = 0; ch < ADS1298_NUM_CHANNELS; ch++)
    {
        hrz_send_ecg_channel(m_ecgs.ecg_channel_handles[ch],
                             (uint8_t *)g_channels.filtered[ch]);
    }
    g_ads1298_state.ble_packet_ready = false;
}

/**@brief Send one channel's data over BLE with retry on buffer full.
 *
 * If the BLE buffer is full (NRF_ERROR_RESOURCES), waits for the
 * BLE_GATTS_EVT_HVN_TX_COMPLETE event and retries once.
 *
 * @param handle  GATT characteristic handle for the channel
 * @param data    Data buffer to send (HRZ_ECGS_MAX_BUFFER_SIZE bytes)
 */
void hrz_send_ecg_channel(ble_gatts_char_handles_t handle, uint8_t * data)
{
    ret_code_t err_code;

    err_code = hrz_ecg_send(&m_ecgs, handle, data, HRZ_ECGS_MAX_BUFFER_SIZE);
    if (err_code == NRF_ERROR_RESOURCES)
    {
        /* BLE TX buffer full - wait for space and retry */
        buffer_is_free = false;
        while (buffer_is_free == false);
        err_code = hrz_ecg_send(&m_ecgs, handle, data, HRZ_ECGS_MAX_BUFFER_SIZE);
        NRF_LOG_WARNING("BLE buffer full, handle value: %d\r\n", handle.value_handle);
    }
    else
    {
        SEND_ERROR_CHECK(err_code);
    }
}
