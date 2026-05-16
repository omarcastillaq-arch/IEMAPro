#!/usr/bin/env python3
"""
Horizon Medical - Edge Inference Engine
=========================================
Optimized inference script for edge devices (RPi 4, Jetson Nano, etc.).

Features:
  - TFLite runtime (no full TensorFlow dependency)
  - Streaming inference from WebSocket / BLE data
  - Real-time preprocessing pipeline
  - Configurable alert thresholds
  - Minimal memory footprint

Usage:
    python edge_inference.py --model ecg_model_quantized.tflite
    python edge_inference.py --model ecg_model_quantized.tflite --demo
    python edge_inference.py --model ecg_model_quantized.tflite --ws ws://localhost:3000
"""

import os
import sys
import json
import time
import argparse
import logging
import numpy as np
from collections import deque
from typing import Optional, Dict, List

# Try TFLite runtime first (lightweight), fall back to full TF
try:
    import tflite_runtime.interpreter as tflite
    USING_TFLITE_RUNTIME = True
    tf = None
except ImportError:
    import tensorflow as tf
    import tensorflow.lite as tflite
    USING_TFLITE_RUNTIME = False

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from signal_pipeline.preprocessing import (
    preprocess_signal,
    bandpass_filter,
    notch_filter,
    normalize,
)
from signal_pipeline.configs import config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("edge_inference")


class ECGEdgeInferenceEngine:
    """Real-time ECG inference engine optimized for edge devices.

    Maintains a sliding buffer of incoming samples, preprocesses
    in chunks, and runs TFLite inference when enough data is collected.
    """

    def __init__(
        self,
        model_path: str,
        segment_length: int = config.MODEL_INPUT_LENGTH,
        sampling_rate: int = config.SAMPLING_RATE_HZ,
        confidence_threshold: float = 0.7,
        alert_classes: Optional[List[int]] = None,
    ):
        """Initialize the edge inference engine.

        Args:
            model_path: Path to TFLite model file.
            segment_length: Number of samples per inference segment.
            sampling_rate: ECG sampling rate in Hz.
            confidence_threshold: Minimum confidence for predictions.
            alert_classes: Class indices that trigger alerts (e.g., [1,2,3] for arrhythmias).
        """
        self.segment_length = segment_length
        self.sampling_rate = sampling_rate
        self.confidence_threshold = confidence_threshold
        self.alert_classes = alert_classes or [1, 2, 3]  # SVEB, VEB, Fusion

        # Circular buffer for incoming samples
        self.buffer = deque(maxlen=segment_length * 2)
        self.last_inference_idx = 0

        # Load TFLite model with Flex delegate support for LSTM ops
        try:
            self.interpreter = tflite.Interpreter(
                model_path=model_path,
                experimental_delegates=[
                    tf.lite.experimental.load_delegate("libtensorflowlite_flex.so")
                ] if not USING_TFLITE_RUNTIME else None,
            )
        except (ValueError, OSError):
            # Fall back without Flex delegate (works for lightweight models)
            self.interpreter = tflite.Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()

        self.input_dtype = self.input_details[0]["dtype"]
        self.input_shape = self.input_details[0]["shape"]

        # Quantization params
        quant_params = self.input_details[0].get("quantization_parameters", {})
        self.input_scale = quant_params.get("scales", np.array([1.0]))[0] if quant_params.get("scales") is not None and len(quant_params.get("scales", [])) > 0 else 1.0
        self.input_zero_point = quant_params.get("zero_points", np.array([0]))[0] if quant_params.get("zero_points") is not None and len(quant_params.get("zero_points", [])) > 0 else 0

        # Stats
        self.inference_count = 0
        self.total_inference_time_ms = 0.0
        self.alerts_triggered = 0

        # Model info
        model_size_kb = os.path.getsize(model_path) / 1024
        logger.info(f"Edge Inference Engine initialized")
        logger.info(f"  Model: {model_path} ({model_size_kb:.1f} KB)")
        logger.info(f"  Input: {self.input_shape}, dtype={self.input_dtype}")
        logger.info(f"  Segment: {segment_length} samples ({segment_length/sampling_rate:.1f}s)")
        logger.info(f"  TFLite runtime: {'tflite_runtime' if USING_TFLITE_RUNTIME else 'tensorflow.lite'}")

    def feed_samples(self, samples: np.ndarray) -> Optional[Dict]:
        """Feed new ECG samples into the buffer.

        When enough samples are collected, runs preprocessing and inference.

        Args:
            samples: 1D array of new ECG samples (raw ADC or pre-converted).

        Returns:
            Inference result dict if prediction was made, None otherwise.
        """
        self.buffer.extend(samples.flatten())

        if len(self.buffer) >= self.segment_length:
            return self._run_inference()
        return None

    def _run_inference(self) -> Dict:
        """Run inference on the current buffer contents."""
        # Extract segment from buffer
        segment = np.array(list(self.buffer))[-self.segment_length:]

        # Preprocess (lightweight version for edge)
        segment_clean = self._preprocess_edge(segment)

        # Reshape for model input: (1, segment_len, 1)
        input_data = segment_clean.reshape(1, self.segment_length, 1).astype(np.float32)

        # Quantize input if needed
        if self.input_dtype == np.uint8:
            input_data = (input_data / self.input_scale + self.input_zero_point).astype(np.uint8)
        elif self.input_dtype == np.int8:
            input_data = (input_data / self.input_scale + self.input_zero_point).astype(np.int8)

        # Run inference
        t0 = time.perf_counter()
        self.interpreter.set_tensor(self.input_details[0]["index"], input_data)
        self.interpreter.invoke()
        output = self.interpreter.get_tensor(self.output_details[0]["index"])
        inference_ms = (time.perf_counter() - t0) * 1000

        # Dequantize output if needed
        out_params = self.output_details[0].get("quantization_parameters", {})
        if self.output_details[0]["dtype"] in (np.uint8, np.int8):
            out_scale = out_params.get("scales", np.array([1.0]))[0]
            out_zp = out_params.get("zero_points", np.array([0]))[0]
            output = (output.astype(np.float32) - out_zp) * out_scale

        probabilities = output[0]
        predicted_class = int(np.argmax(probabilities))
        confidence = float(probabilities[predicted_class])

        # Update stats
        self.inference_count += 1
        self.total_inference_time_ms += inference_ms

        # Check for alerts
        is_alert = (
            predicted_class in self.alert_classes
            and confidence >= self.confidence_threshold
        )
        if is_alert:
            self.alerts_triggered += 1

        result = {
            "timestamp": time.time(),
            "predicted_class": predicted_class,
            "class_name": config.ARRHYTHMIA_CLASSES.get(predicted_class, "Unknown"),
            "confidence": round(confidence, 4),
            "probabilities": {
                config.ARRHYTHMIA_CLASSES.get(i, f"Class {i}"): round(float(p), 4)
                for i, p in enumerate(probabilities)
            },
            "inference_time_ms": round(inference_ms, 2),
            "is_alert": is_alert,
            "buffer_size": len(self.buffer),
        }

        # Clear half the buffer (sliding window)
        half = self.segment_length // 2
        for _ in range(half):
            if self.buffer:
                self.buffer.popleft()

        return result

    def _preprocess_edge(self, sig: np.ndarray) -> np.ndarray:
        """Lightweight preprocessing for edge (minimal compute)."""
        sig = sig.astype(np.float32)
        # Bandpass filter
        sig = bandpass_filter(sig, fs=self.sampling_rate)
        # Quick z-score normalization
        sig = normalize(sig, method="z-score")
        return sig

    def get_stats(self) -> Dict:
        """Get engine runtime statistics."""
        avg_latency = (
            self.total_inference_time_ms / self.inference_count
            if self.inference_count > 0
            else 0
        )
        return {
            "inference_count": self.inference_count,
            "avg_latency_ms": round(avg_latency, 2),
            "total_inference_time_ms": round(self.total_inference_time_ms, 2),
            "alerts_triggered": self.alerts_triggered,
            "buffer_utilization": len(self.buffer) / self.buffer.maxlen,
        }

    def reset(self):
        """Reset buffer and stats."""
        self.buffer.clear()
        self.inference_count = 0
        self.total_inference_time_ms = 0.0
        self.alerts_triggered = 0


def run_demo(engine: ECGEdgeInferenceEngine, duration_sec: float = 30.0):
    """Run a demo simulation feeding synthetic ECG data."""
    logger.info(f"\n🎬 Running demo inference for {duration_sec}s...")

    fs = engine.sampling_rate
    total_samples = int(duration_sec * fs)
    t = np.linspace(0, duration_sec, total_samples)

    # Generate synthetic ECG-like signal
    rng = np.random.RandomState(42)
    ecg = np.sin(2 * np.pi * 1.2 * t)  # ~72 BPM base
    ecg += 0.3 * np.sin(2 * np.pi * 2.4 * t)  # harmonic
    ecg += rng.randn(total_samples) * 0.05  # noise

    # Inject some abnormality around 15s
    abnormal_start = int(14 * fs)
    abnormal_end = int(16 * fs)
    ecg[abnormal_start:abnormal_end] += 2.0 * rng.randn(abnormal_end - abnormal_start)

    # Feed in chunks (simulating BLE packet arrival)
    chunk_size = 21  # ~84ms at 250 SPS (typical BLE packet)
    results = []

    for i in range(0, total_samples, chunk_size):
        chunk = ecg[i : i + chunk_size]
        result = engine.feed_samples(chunk)
        if result:
            alert_str = " ⚠️ ALERT!" if result["is_alert"] else ""
            logger.info(
                f"  [{result['inference_time_ms']:6.2f}ms] "
                f"{result['class_name']:>25} "
                f"(conf={result['confidence']:.3f}){alert_str}"
            )
            results.append(result)

    stats = engine.get_stats()
    logger.info(f"\n📊 Demo Stats:")
    logger.info(f"  Inferences:     {stats['inference_count']}")
    logger.info(f"  Avg latency:    {stats['avg_latency_ms']:.2f} ms")
    logger.info(f"  Alerts:         {stats['alerts_triggered']}")

    return results


def main():
    parser = argparse.ArgumentParser(description="Edge ECG Inference Engine")
    parser.add_argument(
        "--model",
        type=str,
        default=config.MODEL_TFLITE_PATH,
        help="Path to TFLite model",
    )
    parser.add_argument("--demo", action="store_true", help="Run demo with synthetic data")
    parser.add_argument(
        "--confidence-threshold",
        type=float,
        default=0.7,
        help="Minimum confidence for predictions",
    )
    parser.add_argument(
        "--ws",
        type=str,
        default=None,
        help="WebSocket URL for real-time data (e.g., ws://localhost:3000)",
    )
    args = parser.parse_args()

    engine = ECGEdgeInferenceEngine(
        model_path=args.model,
        confidence_threshold=args.confidence_threshold,
    )

    if args.demo:
        run_demo(engine)
    elif args.ws:
        logger.info(f"Connecting to WebSocket: {args.ws}")
        logger.info("WebSocket streaming mode - use Ctrl+C to stop")
        try:
            import websocket
            ws = websocket.WebSocketApp(
                args.ws,
                on_message=lambda ws, msg: _on_ws_message(engine, msg),
            )
            ws.run_forever()
        except ImportError:
            logger.error("websocket-client not installed: pip install websocket-client")
    else:
        logger.info("No input source specified. Use --demo or --ws <url>")
        logger.info("Example: python edge_inference.py --model model.tflite --demo")


def _on_ws_message(engine: ECGEdgeInferenceEngine, message: str):
    """Handle incoming WebSocket message with ECG data."""
    try:
        data = json.loads(message)
        if data.get("type") == "ecg_data" and "samples" in data:
            samples = np.array(data["samples"], dtype=np.float32)
            result = engine.feed_samples(samples)
            if result and result["is_alert"]:
                logger.warning(
                    f"⚠️  ARRHYTHMIA DETECTED: {result['class_name']} "
                    f"(confidence={result['confidence']:.3f})"
                )
    except (json.JSONDecodeError, KeyError) as e:
        logger.debug(f"Skipping message: {e}")


if __name__ == "__main__":
    main()
