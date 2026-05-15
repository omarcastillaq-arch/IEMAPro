"""
Horizon Medical - Model Quantization for Edge Deployment
==========================================================
Convert trained Keras models to optimized formats:
  1. TFLite with INT8 quantization (for RPi, Jetson, Cortex-M)
  2. TFLite float16 (for GPU-enabled edge devices)
  3. ONNX export (for cross-platform inference)

Quantization reduces model size by ~4x and improves inference
latency on edge devices without significant accuracy loss.
"""

import os
import numpy as np
import logging
from typing import Optional

import tensorflow as tf
from tensorflow import keras

from .configs import config

logger = logging.getLogger(__name__)


def quantize_to_tflite_int8(
    model: keras.Model,
    representative_data: Optional[np.ndarray] = None,
    output_path: str = config.MODEL_TFLITE_PATH,
) -> str:
    """Convert Keras model to INT8 quantized TFLite format.

    Uses post-training quantization with a representative dataset
    for full integer quantization (weights + activations).

    Args:
        model: Trained Keras model.
        representative_data: Sample inputs for calibration (X_train subset).
        output_path: Path to save the .tflite file.

    Returns:
        Path to saved TFLite model.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]

    # Enable Select TF Ops for LSTM compatibility in TFLite
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS,
        tf.lite.OpsSet.SELECT_TF_OPS,
    ]
    converter._experimental_lower_tensor_list_ops = False

    # Representative dataset for full INT8 quantization
    if representative_data is not None:
        def representative_dataset_gen():
            for i in range(min(200, len(representative_data))):
                sample = representative_data[i : i + 1].astype(np.float32)
                yield [sample]

        converter.representative_dataset = representative_dataset_gen
        logger.info("INT8 quantization with representative dataset (Select TF Ops enabled)")
    else:
        logger.info("Dynamic range quantization (no representative dataset)")

    tflite_model = converter.convert()

    with open(output_path, "wb") as f:
        f.write(tflite_model)

    original_size = _estimate_model_size(model)
    quantized_size = len(tflite_model) / 1024  # KB

    logger.info(f"TFLite INT8 model saved to: {output_path}")
    logger.info(f"Original size (float32):  {original_size:.1f} KB")
    logger.info(f"Quantized size (INT8):    {quantized_size:.1f} KB")
    logger.info(f"Compression ratio:        {original_size / max(quantized_size, 0.1):.1f}x")

    return output_path


def quantize_to_tflite_float16(
    model: keras.Model,
    output_path: Optional[str] = None,
) -> str:
    """Convert Keras model to float16 TFLite format.

    ~2x smaller than float32 with minimal accuracy loss.
    Better for GPU-enabled edge devices (Jetson Nano).
    """
    if output_path is None:
        output_path = config.MODEL_TFLITE_PATH.replace(".tflite", "_fp16.tflite")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS,
        tf.lite.OpsSet.SELECT_TF_OPS,
    ]
    converter._experimental_lower_tensor_list_ops = False
    converter.target_spec.supported_types = [tf.float16]

    tflite_model = converter.convert()

    with open(output_path, "wb") as f:
        f.write(tflite_model)

    logger.info(f"TFLite FP16 model saved to: {output_path}")
    logger.info(f"Size: {len(tflite_model) / 1024:.1f} KB")
    return output_path


def quantize_to_tflite_dynamic(
    model: keras.Model,
    output_path: Optional[str] = None,
) -> str:
    """Dynamic range quantization (simplest, no calibration data needed).

    Quantizes weights to INT8 but activations remain float32 at runtime.
    """
    if output_path is None:
        output_path = config.MODEL_TFLITE_PATH.replace(".tflite", "_dynamic.tflite")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS,
        tf.lite.OpsSet.SELECT_TF_OPS,
    ]
    converter._experimental_lower_tensor_list_ops = False

    tflite_model = converter.convert()

    with open(output_path, "wb") as f:
        f.write(tflite_model)

    logger.info(f"TFLite dynamic quantized model saved to: {output_path}")
    logger.info(f"Size: {len(tflite_model) / 1024:.1f} KB")
    return output_path


def export_to_onnx(
    model: keras.Model,
    output_path: str = config.MODEL_ONNX_PATH,
) -> str:
    """Export Keras model to ONNX format for cross-platform inference.

    ONNX enables inference with ONNX Runtime, which supports
    various hardware accelerators (CPU, GPU, NPU).
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    try:
        import tf2onnx
        import onnx

        input_signature = [
            tf.TensorSpec(model.input_shape, tf.float32, name="ecg_input")
        ]
        onnx_model, _ = tf2onnx.convert.from_keras(
            model,
            input_signature=input_signature,
            opset=config.ONNX_OPSET_VERSION,
        )
        onnx.save(onnx_model, output_path)
        logger.info(f"ONNX model saved to: {output_path}")
        logger.info(f"Size: {os.path.getsize(output_path) / 1024:.1f} KB")
        return output_path

    except ImportError:
        logger.warning("tf2onnx not installed. Skipping ONNX export.")
        logger.warning("Install with: pip install tf2onnx onnx")
        return ""


def _estimate_model_size(model: keras.Model) -> float:
    """Estimate model size in KB (float32)."""
    return (model.count_params() * 4) / 1024


def get_quantization_report(
    model: keras.Model,
    tflite_int8_path: str,
    tflite_fp16_path: Optional[str] = None,
    onnx_path: Optional[str] = None,
) -> dict:
    """Generate a quantization comparison report."""
    original_kb = _estimate_model_size(model)

    report = {
        "original_model": {
            "format": "Keras (float32)",
            "size_kb": round(original_kb, 1),
            "params": model.count_params(),
        },
        "quantized_models": {},
    }

    if os.path.exists(tflite_int8_path):
        size = os.path.getsize(tflite_int8_path) / 1024
        report["quantized_models"]["tflite_int8"] = {
            "path": tflite_int8_path,
            "size_kb": round(size, 1),
            "compression_ratio": round(original_kb / max(size, 0.1), 1),
        }

    if tflite_fp16_path and os.path.exists(tflite_fp16_path):
        size = os.path.getsize(tflite_fp16_path) / 1024
        report["quantized_models"]["tflite_fp16"] = {
            "path": tflite_fp16_path,
            "size_kb": round(size, 1),
            "compression_ratio": round(original_kb / max(size, 0.1), 1),
        }

    if onnx_path and os.path.exists(onnx_path):
        size = os.path.getsize(onnx_path) / 1024
        report["quantized_models"]["onnx"] = {
            "path": onnx_path,
            "size_kb": round(size, 1),
        }

    return report
