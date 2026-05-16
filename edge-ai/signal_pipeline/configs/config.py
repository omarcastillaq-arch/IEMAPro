"""
Horizon Medical - Edge AI ECG Signal Pipeline Configuration
============================================================
Central configuration for signal preprocessing, model architecture,
training, and edge deployment parameters.
"""

# ──────────────────────────────────────────────────────────────
#  Signal Acquisition Parameters (ADS1298 / IoT Holter)
# ──────────────────────────────────────────────────────────────
SAMPLING_RATE_HZ = 250          # ADS1298 configured at 250 SPS
ADC_RESOLUTION_BITS = 24        # 24-bit ADC
ADC_VREF_MV = 2400.0            # Reference voltage in mV
ADC_GAIN = 6                    # PGA gain
NUM_CHANNELS = 8                # 8-channel ADS1298

# ──────────────────────────────────────────────────────────────
#  Signal Preprocessing
# ──────────────────────────────────────────────────────────────
# Bandpass filter (remove baseline wander + high-freq noise)
BANDPASS_LOW_HZ = 0.5           # High-pass cutoff
BANDPASS_HIGH_HZ = 45.0         # Low-pass cutoff (below 50/60 Hz mains)
FILTER_ORDER = 4                # Butterworth filter order

# Notch filter for powerline interference
NOTCH_FREQ_HZ = 60.0           # 60 Hz (Colombia), change to 50 for EU
NOTCH_Q_FACTOR = 30.0           # Quality factor

# Segmentation
SEGMENT_DURATION_SEC = 10.0     # 10-second ECG segments
SEGMENT_SAMPLES = int(SAMPLING_RATE_HZ * SEGMENT_DURATION_SEC)  # 2500 samples
SEGMENT_OVERLAP_RATIO = 0.25    # 25% overlap for augmentation

# Normalization
NORMALIZATION_METHOD = "z-score"  # "z-score" | "min-max" | "robust"

# ──────────────────────────────────────────────────────────────
#  Arrhythmia Classification Labels
# ──────────────────────────────────────────────────────────────
# MIT-BIH compatible beat annotation mapping
ARRHYTHMIA_CLASSES = {
    0: "Normal (N)",
    1: "Supraventricular (SVEB)",
    2: "Ventricular (VEB)",
    3: "Fusion (F)",
    4: "Unknown (Q)",
}
NUM_CLASSES = len(ARRHYTHMIA_CLASSES)

# AAMI beat-type grouping from MIT-BIH annotations
AAMI_MAPPING = {
    # Normal
    "N": 0, "L": 0, "R": 0, "e": 0, "j": 0,
    # SVEB
    "A": 1, "a": 1, "J": 1, "S": 1,
    # VEB
    "V": 2, "E": 2,
    # Fusion
    "F": 3,
    # Unknown
    "/": 4, "f": 4, "Q": 4,
}

# ──────────────────────────────────────────────────────────────
#  Model Architecture (CNN-LSTM)
# ──────────────────────────────────────────────────────────────
MODEL_INPUT_LENGTH = SEGMENT_SAMPLES   # 2500 samples
MODEL_INPUT_CHANNELS = 1               # Single-lead for edge (Lead II)
CNN_FILTERS = [32, 64, 128]            # Conv1D filter progression
CNN_KERNEL_SIZE = 7                    # Kernel size for Conv1D
CNN_POOL_SIZE = 2                      # MaxPooling
LSTM_UNITS = [64, 32]                  # Bi-LSTM units
DENSE_UNITS = 64                       # Pre-output dense layer
DROPOUT_RATE = 0.3                     # Dropout for regularization

# ──────────────────────────────────────────────────────────────
#  Training
# ──────────────────────────────────────────────────────────────
BATCH_SIZE = 64
EPOCHS = 50
LEARNING_RATE = 1e-3
EARLY_STOPPING_PATIENCE = 10
LR_REDUCE_PATIENCE = 5
LR_REDUCE_FACTOR = 0.5
VALIDATION_SPLIT = 0.15
TEST_SPLIT = 0.15
RANDOM_SEED = 42

# Class weights to handle imbalanced MIT-BIH dataset
USE_CLASS_WEIGHTS = True

# ──────────────────────────────────────────────────────────────
#  Edge Deployment / Quantization
# ──────────────────────────────────────────────────────────────
TFLITE_QUANTIZE = True                 # Enable INT8 quantization
TFLITE_OPTIMIZATION = "DEFAULT"        # "DEFAULT" | "OPTIMIZE_FOR_SIZE" | "OPTIMIZE_FOR_LATENCY"
ONNX_OPSET_VERSION = 13               # ONNX opset for compatibility

# Edge device constraints
EDGE_MAX_MODEL_SIZE_KB = 500           # Target: < 500 KB for edge
EDGE_MAX_LATENCY_MS = 100             # Target: < 100 ms inference
EDGE_TARGET_PLATFORMS = [
    "raspberry_pi_4",
    "jetson_nano",
    "nrf52840",                        # Cortex-M4F (TFLite Micro)
]

# ──────────────────────────────────────────────────────────────
#  File Paths
# ──────────────────────────────────────────────────────────────
MODEL_SAVE_DIR = "signal_pipeline/models"
MODEL_KERAS_PATH = f"{MODEL_SAVE_DIR}/ecg_cnn_lstm_model.keras"
MODEL_TFLITE_PATH = f"{MODEL_SAVE_DIR}/exported/ecg_model_quantized.tflite"
MODEL_ONNX_PATH = f"{MODEL_SAVE_DIR}/exported/ecg_model.onnx"
DATA_DIR = "signal_pipeline/data"
TRAINING_HISTORY_PATH = f"{MODEL_SAVE_DIR}/training_history.json"
METRICS_REPORT_PATH = f"{MODEL_SAVE_DIR}/evaluation_metrics.json"
