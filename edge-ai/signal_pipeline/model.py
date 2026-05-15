"""
Horizon Medical - CNN-LSTM Model for ECG Arrhythmia Classification
===================================================================
Optimized architecture for 1D ECG signal classification,
designed for edge deployment on constrained devices.

Architecture:
  Input (2500, 1) → Conv1D blocks → BiLSTM → Dense → Softmax (5 classes)

Design choices:
  - Depthwise separable convolutions to reduce parameters
  - Bidirectional LSTM to capture temporal context
  - Global Average Pooling to reduce overfitting
  - Batch normalization for training stability
  - Designed to fit < 500 KB after INT8 quantization
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model, regularizers
from typing import Optional, Tuple
import logging

from .configs import config

logger = logging.getLogger(__name__)


def build_cnn_lstm_model(
    input_length: int = config.MODEL_INPUT_LENGTH,
    input_channels: int = config.MODEL_INPUT_CHANNELS,
    num_classes: int = config.NUM_CLASSES,
    cnn_filters: list = None,
    lstm_units: list = None,
    dropout_rate: float = config.DROPOUT_RATE,
) -> keras.Model:
    """Build the CNN-LSTM model for ECG arrhythmia classification.

    Args:
        input_length: Number of samples per segment (default: 2500).
        input_channels: Number of ECG channels (default: 1 for Lead II).
        num_classes: Number of output classes (default: 5 AAMI classes).
        cnn_filters: List of filter counts for Conv1D blocks.
        lstm_units: List of LSTM unit counts.
        dropout_rate: Dropout rate for regularization.

    Returns:
        Compiled Keras model.
    """
    if cnn_filters is None:
        cnn_filters = config.CNN_FILTERS
    if lstm_units is None:
        lstm_units = config.LSTM_UNITS

    inputs = layers.Input(shape=(input_length, input_channels), name="ecg_input")
    x = inputs

    # ── CNN Feature Extraction Blocks ──
    for i, filters in enumerate(cnn_filters):
        # Standard Conv1D (first block) or Separable (subsequent blocks)
        if i == 0:
            x = layers.Conv1D(
                filters,
                kernel_size=config.CNN_KERNEL_SIZE,
                padding="same",
                kernel_regularizer=regularizers.l2(1e-4),
                name=f"conv1d_{i}",
            )(x)
        else:
            x = layers.SeparableConv1D(
                filters,
                kernel_size=config.CNN_KERNEL_SIZE,
                padding="same",
                depthwise_regularizer=regularizers.l2(1e-4),
                name=f"sep_conv1d_{i}",
            )(x)

        x = layers.BatchNormalization(name=f"bn_{i}")(x)
        x = layers.ReLU(name=f"relu_{i}")(x)
        x = layers.MaxPooling1D(
            pool_size=config.CNN_POOL_SIZE,
            name=f"maxpool_{i}",
        )(x)
        x = layers.SpatialDropout1D(dropout_rate * 0.5, name=f"spatial_drop_{i}")(x)

    # ── Bi-LSTM Temporal Modelling ──
    for i, units in enumerate(lstm_units):
        return_sequences = i < len(lstm_units) - 1
        x = layers.Bidirectional(
            layers.LSTM(
                units,
                return_sequences=return_sequences,
                dropout=dropout_rate,
                recurrent_dropout=0.0,  # 0 for CuDNN compatibility
                name=f"lstm_{i}",
            ),
            name=f"bilstm_{i}",
        )(x)

    # ── Classification Head ──
    x = layers.Dense(
        config.DENSE_UNITS,
        kernel_regularizer=regularizers.l2(1e-4),
        name="dense_pre",
    )(x)
    x = layers.BatchNormalization(name="bn_dense")(x)
    x = layers.ReLU(name="relu_dense")(x)
    x = layers.Dropout(dropout_rate, name="dropout_dense")(x)

    outputs = layers.Dense(num_classes, activation="softmax", name="predictions")(x)

    model = Model(inputs=inputs, outputs=outputs, name="ECG_CNN_LSTM")
    return model


def build_lightweight_model(
    input_length: int = config.MODEL_INPUT_LENGTH,
    num_classes: int = config.NUM_CLASSES,
) -> keras.Model:
    """Ultra-lightweight model for highly constrained edge devices
    (e.g., Cortex-M4F / nRF52840).

    Uses only Conv1D + GlobalAveragePooling (no LSTM) to minimize
    memory footprint and enable TFLite Micro deployment.

    Target: < 100 KB after quantization.
    """
    inputs = layers.Input(shape=(input_length, 1), name="ecg_input")
    x = inputs

    # Compact CNN blocks
    for filters in [16, 32, 64]:
        x = layers.Conv1D(filters, kernel_size=5, padding="same")(x)
        x = layers.BatchNormalization()(x)
        x = layers.ReLU()(x)
        x = layers.MaxPooling1D(pool_size=4)(x)

    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="predictions")(x)

    model = Model(inputs=inputs, outputs=outputs, name="ECG_Lightweight")
    return model


def compile_model(
    model: keras.Model,
    learning_rate: float = config.LEARNING_RATE,
    num_classes: int = config.NUM_CLASSES,
) -> keras.Model:
    """Compile model with appropriate loss and metrics."""
    optimizer = keras.optimizers.Adam(learning_rate=learning_rate)

    if num_classes == 2:
        loss = "binary_crossentropy"
        metrics = ["accuracy"]
    else:
        loss = "categorical_crossentropy"
        metrics = [
            "accuracy",
            keras.metrics.Precision(name="precision"),
            keras.metrics.Recall(name="recall"),
        ]

    model.compile(optimizer=optimizer, loss=loss, metrics=metrics)
    return model


def get_model_summary(model: keras.Model) -> dict:
    """Extract model summary info as a dictionary."""
    total_params = model.count_params()
    trainable = sum(
        tf.keras.backend.count_params(w) for w in model.trainable_weights
    )
    non_trainable = total_params - trainable

    # Estimate model size (float32)
    size_mb = (total_params * 4) / (1024 * 1024)

    return {
        "name": model.name,
        "total_params": total_params,
        "trainable_params": trainable,
        "non_trainable_params": non_trainable,
        "estimated_size_mb": round(size_mb, 3),
        "input_shape": str(model.input_shape),
        "output_shape": str(model.output_shape),
        "num_layers": len(model.layers),
    }
