/* Copyright (c) 2017 Horizon Medical SAS, Cartagena - Colombia.
 * All Rights Reserved.
 *
 * Phase 3 Refactoring:
 * - Introduced hrz_ads1298_state_t to encapsulate device state (replaces
 *   scattered global booleans: ads1298_data_ready, ble_packet_ready, etc.)
 * - Introduced hrz_ecg_channels_t to hold all 8 channel buffers in arrays
 *   (replaces 24 individual static arrays).
 * - Improved error handling with hrz_ads1298_error_t enum.
 * - All public API remains compatible with existing callers.
 */

#ifndef HRZ_ADS1298_H
#define HRZ_ADS1298_H

#ifdef __cplusplus
extern "C" {
#endif

#include "custom_board.h"
#include "nrf_drv_spi.h"
#include "nrf_drv_gpiote.h"
#include "HRZ_ADS1298_LP_Filter.h"

/* ============================================================================
 * ADS1298 Hardware Definitions
 * ============================================================================ */
#define ADS1298_SELECT()    nrf_gpio_pin_clear(ADS1298_SPI_SS_PIN)
#define ADS1298_DESELECT()  nrf_gpio_pin_set(ADS1298_SPI_SS_PIN)

/** @brief SPI buffer size: 3 status bytes + 24 channel bytes = 27 bytes
 *  (8 channels × 3 bytes per channel, datasheet page 60) */
#define ADS1298_SPI_BUFFER_SIZE 27

/** @brief Number of ADS1298 channels (must match HRZ_ECG_NUM_CHANNELS in ecg_service.h) */
#define ADS1298_NUM_CHANNELS    8

/* ============================================================================
 * ADS1298 SPI Commands (datasheet p61)
 * ============================================================================ */
#define ADS1298_WAKEUPC  0x02
#define ADS1298_STANDBYC 0x04
#define ADS1298_RESETC   0x06
#define ADS1298_STARTC   0x08
#define ADS1298_STOPC    0x0A
#define ADS1298_RDATACC  0x10
#define ADS1298_SDATACC  0x11
#define ADS1298_RDATAC   0x12
/* Read/write nnnnn registers starting at address rrrrr.
 * nnnnn = number of registers to be read/written - 1
 * First byte = 001rrrrr, second byte = 000nnnnn. */
#define ADS1298_RREGC    0x20
/* First byte = 010rrrrr, second byte = 000nnnnn. */
#define ADS1298_WREGC    0x40

/* ============================================================================
 * Error Handling
 * ============================================================================ */

/**@brief Macro for calling error handler function if there is an error while
 * sending channel data over BLE.
 *
 * @param[in] ERR_CODE Error code supplied to the error handler.
 */
#define SEND_ERROR_CHECK(ERR_CODE)                                  \
    do                                                              \
    {                                                               \
        const uint32_t LOCAL_ERR_CODE = (ERR_CODE);                 \
        if (LOCAL_ERR_CODE == NRF_ERROR_RESOURCES) {                \
          NRF_LOG_ERROR("Buffer full\r\n");                         \
        }                                                           \
        else if ((LOCAL_ERR_CODE != NRF_SUCCESS) &&                 \
              (LOCAL_ERR_CODE != NRF_ERROR_INVALID_STATE) &&        \
              (LOCAL_ERR_CODE != BLE_ERROR_GATTS_SYS_ATTR_MISSING)  \
            )                                                       \
          {                                                         \
              NRF_LOG_ERROR("Error code: %d\r\n", LOCAL_ERR_CODE);  \
              APP_ERROR_HANDLER(LOCAL_ERR_CODE);                    \
          }                                                         \
    } while (0)

/**@brief ADS1298 error codes for improved error handling */
typedef enum
{
    HRZ_ADS1298_SUCCESS = 0,          /**< Operation completed successfully */
    HRZ_ADS1298_ERR_SPI_INIT,         /**< SPI initialization failed */
    HRZ_ADS1298_ERR_INT_INIT,         /**< Interrupt initialization failed */
    HRZ_ADS1298_ERR_NOT_CONFIGURED,   /**< Device not yet configured */
    HRZ_ADS1298_ERR_INVALID_CHANNEL,  /**< Invalid channel number (must be 1-8) */
    HRZ_ADS1298_ERR_SPI_TRANSFER,     /**< SPI transfer failed */
    HRZ_ADS1298_ERR_BLE_SEND,         /**< BLE send failed */
} hrz_ads1298_error_t;

/* ============================================================================
 * Data Structures
 * ============================================================================ */

/**@brief SPI Bus Data Output for the ADS1298 (Eight Channels) */
typedef struct __attribute__((packed))
{
    uint32_t status : 24;
    uint32_t channel1 : 24;
    uint32_t channel2 : 24;
    uint32_t channel3 : 24;
    uint32_t channel4 : 24;
    uint32_t channel5 : 24;
    uint32_t channel6 : 24;
    uint32_t channel7 : 24;
    uint32_t channel8 : 24;
} hrz_ads1298_data_t;

/**@brief Channel data structure (3 bytes per sample).
 * Used to store raw 24-bit ADC samples before BLE transmission. */
typedef struct
{
  uint8_t b1;
  uint8_t b2;
  uint8_t b3;
} hrz_channel_data_t;

/**@brief Encapsulated ADS1298 device state.
 *
 * Refactored: Replaces scattered global booleans (ads1298_data_ready,
 * ads1298_data_received, ads1298_configured, ble_packet_ready) with
 * a single state structure for better encapsulation and testability.
 */
typedef struct
{
    volatile bool data_ready;        /**< DRDY interrupt received, data available to read */
    volatile bool data_received;     /**< SPI transfer complete, data in rx buffer */
    bool          configured;        /**< ADS1298 register configuration complete */
    bool          ble_packet_ready;  /**< Enough samples collected, ready to send over BLE */
    size_t        sample_count;      /**< Current sample index within the packet buffer */
} hrz_ads1298_state_t;

/**@brief Encapsulated ECG channel buffers for all 8 channels.
 *
 * Refactored: Replaces 24 individual static arrays (8 raw + 8 q31 + 8 filtered)
 * with 3 two-dimensional arrays indexed by channel.
 * Access pattern: channels.raw[ch][sample], channels.q31[ch][sample], etc.
 */
typedef struct
{
    hrz_channel_data_t raw[ADS1298_NUM_CHANNELS][HRZ_SAMPLES_PER_PACKET];   /**< Raw 3-byte samples per channel */
    q31_t              q31[ADS1298_NUM_CHANNELS][HRZ_SAMPLES_PER_PACKET];   /**< Converted q31 samples (for filtering) */
    q31_t              filtered[ADS1298_NUM_CHANNELS][HRZ_SAMPLES_PER_PACKET]; /**< Filtered q31 output */
} hrz_ecg_channels_t;

/* ============================================================================
 * Global State (extern declarations)
 *
 * Legacy globals are kept as extern for backward compatibility with main.c.
 * New code should use hrz_ads1298_get_state() where possible.
 * ============================================================================ */
extern hrz_ads1298_state_t g_ads1298_state;  /**< Global device state */

/* Legacy compatibility macros - map old global names to new state struct.
 * These ensure main.c and other modules compile without changes. */
#define ads1298_data_ready   g_ads1298_state.data_ready
#define ble_packet_ready     g_ads1298_state.ble_packet_ready

static volatile bool spi_xfer_done;  /**< SPI completed the transfer. */
static const nrf_drv_spi_t ads1298_spi = NRF_DRV_SPI_INSTANCE(ADS1298_SPI_INSTANCE); /**< SPI instance. */

/* ============================================================================
 * Function Prototypes
 * ============================================================================ */

/** @brief SPI and hardware initialization */
void hrz_ads1298_spi_init(void);
void hrz_ads1298_spi_event_handler(nrf_drv_spi_evt_t const * p_event, void * p_context);
void hrz_ads1298_int_init(void);
void hrz_ads1298_int_pin_handler(nrf_drv_gpiote_pin_t pin, nrf_gpiote_polarity_t action);

/** @brief Device control */
void hrz_ads1298_init(void);
void hrz_start_ads1298(void);
void hrz_stop_ads1298(void);

/** @brief SPI communication */
void hrz_ads1298_spi_txrx(uint8_t * m_tx_buf, uint8_t m_tx_length, uint8_t m_rx_length);

/** @brief Data conversion utilities */
q31_t hrz_convert_24bit_twos_complement_to_int(uint8_t *buffer, uint8_t channel);
hrz_channel_data_t hrz_get_sample_from_buffer(uint8_t *buffer, uint8_t channel);

/** @brief Data acquisition and processing */
void hrz_get_ads1298_data(void);
arm_status hrz_filter_data(void);

/** @brief BLE data transmission */
void hrz_send_data_over_BLE(void);
void hrz_send_filtered_data_over_BLE(void);
void hrz_send_ecg_channel(ble_gatts_char_handles_t handle, uint8_t * data);

/** @brief State accessors (for modules that prefer struct-based access) */
hrz_ads1298_state_t * hrz_ads1298_get_state(void);

#ifdef __cplusplus
}
#endif

#endif // HRZ_ADS1298_H
