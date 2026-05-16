#!/usr/bin/env python3
"""
Horizon Medical - Model Export & Quantization Script
======================================================
Export trained model to optimized formats for edge deployment.

Usage:
    python -m signal_pipeline.scripts.export_model [--model path] [--all]
"""

import os
import sys
import json
import argparse
import logging
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import tensorflow as tf
from tensorflow import keras

from signal_pipeline.configs import config
from signal_pipeline.quantize import (
    quantize_to_tflite_int8,
    quantize_to_tflite_float16,
    quantize_to_tflite_dynamic,
    export_to_onnx,
    get_quantization_report,
)
from signal_pipeline.data_loader import generate_synthetic_ecg

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Export and quantize ECG model")
    parser.add_argument("--model", type=str, default=config.MODEL_KERAS_PATH, help="Path to Keras model")
    parser.add_argument("--all", action="store_true", help="Export all formats (INT8, FP16, dynamic, ONNX)")
    parser.add_argument("--int8", action="store_true", help="Export TFLite INT8")
    parser.add_argument("--fp16", action="store_true", help="Export TFLite FP16")
    parser.add_argument("--dynamic", action="store_true", help="Export TFLite dynamic range")
    parser.add_argument("--onnx", action="store_true", help="Export ONNX")
    args = parser.parse_args()

    # Default to all if nothing specified
    if not any([args.int8, args.fp16, args.dynamic, args.onnx]):
        args.all = True

    logger.info("=" * 60)
    logger.info("Horizon Medical - Model Export & Quantization")
    logger.info("=" * 60)

    # Load model
    logger.info(f"\nLoading model from: {args.model}")
    model = keras.models.load_model(args.model)
    model.summary(print_fn=logger.info)

    # Generate representative data for INT8 calibration
    logger.info("\nGenerating calibration data...")
    X_cal, _ = generate_synthetic_ecg(n_samples=500, segment_len=config.MODEL_INPUT_LENGTH)

    exported = {}

    # INT8 quantization
    if args.all or args.int8:
        logger.info("\n── TFLite INT8 Quantization ──")
        try:
            path = quantize_to_tflite_int8(model, representative_data=X_cal)
            exported["tflite_int8"] = path
        except Exception as e:
            logger.error(f"INT8 quantization failed: {e}")
            # Fallback to dynamic range
            logger.info("Falling back to dynamic range quantization...")
            path = quantize_to_tflite_dynamic(model, output_path=config.MODEL_TFLITE_PATH)
            exported["tflite_dynamic"] = path

    # FP16 quantization
    if args.all or args.fp16:
        logger.info("\n── TFLite FP16 Quantization ──")
        try:
            path = quantize_to_tflite_float16(model)
            exported["tflite_fp16"] = path
        except Exception as e:
            logger.error(f"FP16 quantization failed: {e}")

    # Dynamic range quantization
    if args.all or args.dynamic:
        logger.info("\n── TFLite Dynamic Range ──")
        try:
            path = quantize_to_tflite_dynamic(model)
            exported["tflite_dynamic"] = path
        except Exception as e:
            logger.error(f"Dynamic quantization failed: {e}")

    # ONNX export
    if args.all or args.onnx:
        logger.info("\n── ONNX Export ──")
        try:
            path = export_to_onnx(model)
            if path:
                exported["onnx"] = path
        except Exception as e:
            logger.warning(f"ONNX export failed: {e}")

    # Quantization report
    logger.info("\n── Quantization Summary ──")
    tflite_path = exported.get("tflite_int8", exported.get("tflite_dynamic", ""))
    fp16_path = exported.get("tflite_fp16", "")
    onnx_path = exported.get("onnx", "")

    report = get_quantization_report(model, tflite_path, fp16_path, onnx_path)
    report_path = os.path.join(config.MODEL_SAVE_DIR, "exported", "quantization_report.json")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    logger.info(f"\nOriginal model: {report['original_model']['size_kb']:.1f} KB ({report['original_model']['params']:,} params)")
    for name, info in report["quantized_models"].items():
        logger.info(f"  {name}: {info['size_kb']:.1f} KB (compression: {info.get('compression_ratio', 'N/A')}x)")

    logger.info(f"\nReport saved to: {report_path}")
    logger.info(f"Exported models: {list(exported.keys())}")
    logger.info("\n✅ Export complete")


if __name__ == "__main__":
    main()
