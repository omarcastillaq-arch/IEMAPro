"""
Horizon Medical - Model Evaluation Module
===========================================
Comprehensive evaluation metrics for ECG arrhythmia classification:
  - Accuracy, Precision, Recall, F1-Score (per-class and macro)
  - Confusion matrix
  - ROC AUC (per-class)
  - Inference latency benchmarking
"""

import os
import numpy as np
import json
import time
import logging
from typing import Optional
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
    roc_auc_score,
)

from .configs import config

logger = logging.getLogger(__name__)


def evaluate_model(
    model,
    X_test: np.ndarray,
    y_test: np.ndarray,
    batch_size: int = config.BATCH_SIZE,
    n_latency_runs: int = 100,
) -> dict:
    """Comprehensive model evaluation.

    Args:
        model: Trained Keras model.
        X_test: Test features, shape (n, segment_len, 1).
        y_test: One-hot encoded test labels, shape (n, num_classes).
        batch_size: Batch size for prediction.
        n_latency_runs: Number of single-sample inferences for latency benchmarking.

    Returns:
        Dictionary with all evaluation metrics.
    """
    # Predictions
    y_pred_proba = model.predict(X_test, batch_size=batch_size, verbose=0)
    y_pred = np.argmax(y_pred_proba, axis=1)
    y_true = np.argmax(y_test, axis=1) if y_test.ndim > 1 else y_test

    num_classes = y_pred_proba.shape[1]
    class_names = [config.ARRHYTHMIA_CLASSES.get(i, f"Class {i}") for i in range(num_classes)]

    # Core metrics
    accuracy = accuracy_score(y_true, y_pred)
    precision_macro = precision_score(y_true, y_pred, average="macro", zero_division=0)
    recall_macro = recall_score(y_true, y_pred, average="macro", zero_division=0)
    f1_macro = f1_score(y_true, y_pred, average="macro", zero_division=0)
    f1_weighted = f1_score(y_true, y_pred, average="weighted", zero_division=0)

    # Per-class metrics
    precision_per_class = precision_score(y_true, y_pred, average=None, zero_division=0)
    recall_per_class = recall_score(y_true, y_pred, average=None, zero_division=0)
    f1_per_class = f1_score(y_true, y_pred, average=None, zero_division=0)

    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred)

    # ROC AUC (per-class, one-vs-rest)
    try:
        if y_test.ndim == 1:
            y_test_onehot = np.eye(num_classes)[y_test]
        else:
            y_test_onehot = y_test
        roc_auc = roc_auc_score(y_test_onehot, y_pred_proba, average="macro", multi_class="ovr")
        roc_auc_per_class = []
        for i in range(num_classes):
            try:
                auc_i = roc_auc_score(y_test_onehot[:, i], y_pred_proba[:, i])
                roc_auc_per_class.append(round(float(auc_i), 4))
            except ValueError:
                roc_auc_per_class.append(None)
    except ValueError as e:
        logger.warning(f"ROC AUC calculation failed: {e}")
        roc_auc = None
        roc_auc_per_class = [None] * num_classes

    # Inference latency benchmark (single sample)
    latencies = []
    single_sample = X_test[:1]
    for _ in range(n_latency_runs):
        t0 = time.perf_counter()
        _ = model.predict(single_sample, verbose=0)
        latencies.append((time.perf_counter() - t0) * 1000)  # ms

    latency_stats = {
        "mean_ms": round(float(np.mean(latencies)), 2),
        "median_ms": round(float(np.median(latencies)), 2),
        "p95_ms": round(float(np.percentile(latencies, 95)), 2),
        "p99_ms": round(float(np.percentile(latencies, 99)), 2),
        "min_ms": round(float(np.min(latencies)), 2),
        "max_ms": round(float(np.max(latencies)), 2),
    }

    # Classification report
    cls_report = classification_report(
        y_true, y_pred, target_names=class_names, zero_division=0, output_dict=True
    )

    metrics = {
        "overall": {
            "accuracy": round(float(accuracy), 4),
            "precision_macro": round(float(precision_macro), 4),
            "recall_macro": round(float(recall_macro), 4),
            "f1_macro": round(float(f1_macro), 4),
            "f1_weighted": round(float(f1_weighted), 4),
            "roc_auc_macro": round(float(roc_auc), 4) if roc_auc else None,
            "num_test_samples": int(len(y_true)),
        },
        "per_class": {},
        "confusion_matrix": cm.tolist(),
        "inference_latency": latency_stats,
        "classification_report": cls_report,
    }

    for i, name in enumerate(class_names):
        metrics["per_class"][name] = {
            "precision": round(float(precision_per_class[i]), 4) if i < len(precision_per_class) else 0,
            "recall": round(float(recall_per_class[i]), 4) if i < len(recall_per_class) else 0,
            "f1_score": round(float(f1_per_class[i]), 4) if i < len(f1_per_class) else 0,
            "roc_auc": roc_auc_per_class[i] if i < len(roc_auc_per_class) else None,
            "support": int(np.sum(y_true == i)),
        }

    return metrics


def generate_evaluation_report(metrics: dict) -> str:
    """Generate a human-readable evaluation report string."""
    lines = [
        "=" * 60,
        "  ECG Arrhythmia Classification - Evaluation Report",
        "=" * 60,
        "",
        "── Overall Metrics ──",
        f"  Accuracy:         {metrics['overall']['accuracy']:.4f}",
        f"  Precision (macro): {metrics['overall']['precision_macro']:.4f}",
        f"  Recall (macro):    {metrics['overall']['recall_macro']:.4f}",
        f"  F1 Score (macro):  {metrics['overall']['f1_macro']:.4f}",
        f"  F1 Score (weighted): {metrics['overall']['f1_weighted']:.4f}",
        f"  ROC AUC (macro):   {metrics['overall'].get('roc_auc_macro', 'N/A')}",
        f"  Test samples:      {metrics['overall']['num_test_samples']}",
        "",
        "── Per-Class Metrics ──",
        f"  {'Class':<25} {'Prec':>8} {'Rec':>8} {'F1':>8} {'AUC':>8} {'Support':>8}",
        f"  {'-'*25} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8}",
    ]

    for cls_name, cls_metrics in metrics["per_class"].items():
        auc_str = f"{cls_metrics['roc_auc']:.4f}" if cls_metrics["roc_auc"] is not None else "N/A"
        lines.append(
            f"  {cls_name:<25} {cls_metrics['precision']:>8.4f} "
            f"{cls_metrics['recall']:>8.4f} {cls_metrics['f1_score']:>8.4f} "
            f"{auc_str:>8} {cls_metrics['support']:>8}"
        )

    lines.extend([
        "",
        "── Inference Latency (single sample) ──",
        f"  Mean:   {metrics['inference_latency']['mean_ms']:.2f} ms",
        f"  Median: {metrics['inference_latency']['median_ms']:.2f} ms",
        f"  P95:    {metrics['inference_latency']['p95_ms']:.2f} ms",
        f"  P99:    {metrics['inference_latency']['p99_ms']:.2f} ms",
        "",
        "── Confusion Matrix ──",
    ])

    cm = np.array(metrics["confusion_matrix"])
    class_names = list(metrics["per_class"].keys())
    header = "  " + " " * 18 + " ".join(f"{n[:6]:>8}" for n in class_names)
    lines.append(header)
    for i, row in enumerate(cm):
        name = class_names[i] if i < len(class_names) else f"Class {i}"
        row_str = " ".join(f"{v:>8d}" for v in row)
        lines.append(f"  {name:<18} {row_str}")

    lines.append("")
    lines.append("=" * 60)
    return "\n".join(lines)


def evaluate_tflite_model(
    tflite_path: str,
    X_test: np.ndarray,
    y_test: np.ndarray,
    n_latency_runs: int = 100,
) -> dict:
    """Evaluate a TFLite quantized model.

    Returns metrics dict comparable to evaluate_model output.
    """
    import tensorflow as tf

    interpreter = tf.lite.Interpreter(model_path=tflite_path)
    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    input_dtype = input_details[0]["dtype"]
    input_scale = input_details[0].get("quantization_parameters", {}).get("scales", [1.0])
    input_zp = input_details[0].get("quantization_parameters", {}).get("zero_points", [0])

    # Run predictions
    y_pred_all = []
    for i in range(len(X_test)):
        sample = X_test[i:i+1].copy()
        if input_dtype == np.uint8 or input_dtype == np.int8:
            sample = (sample / input_scale[0] + input_zp[0]).astype(input_dtype)

        interpreter.set_tensor(input_details[0]["index"], sample)
        interpreter.invoke()
        output = interpreter.get_tensor(output_details[0]["index"])
        y_pred_all.append(output[0])

    y_pred_proba = np.array(y_pred_all, dtype=np.float32)
    y_pred = np.argmax(y_pred_proba, axis=1)
    y_true = np.argmax(y_test, axis=1) if y_test.ndim > 1 else y_test

    # Latency benchmark
    latencies = []
    sample = X_test[:1].copy()
    if input_dtype == np.uint8 or input_dtype == np.int8:
        sample = (sample / input_scale[0] + input_zp[0]).astype(input_dtype)

    for _ in range(n_latency_runs):
        t0 = time.perf_counter()
        interpreter.set_tensor(input_details[0]["index"], sample)
        interpreter.invoke()
        _ = interpreter.get_tensor(output_details[0]["index"])
        latencies.append((time.perf_counter() - t0) * 1000)

    num_classes = y_pred_proba.shape[1]
    class_names = [config.ARRHYTHMIA_CLASSES.get(i, f"Class {i}") for i in range(num_classes)]

    return {
        "model_type": "tflite_quantized",
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "f1_macro": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "inference_latency": {
            "mean_ms": round(float(np.mean(latencies)), 2),
            "median_ms": round(float(np.median(latencies)), 2),
            "p95_ms": round(float(np.percentile(latencies, 95)), 2),
        },
        "model_size_kb": round(os.path.getsize(tflite_path) / 1024, 1) if os.path.exists(tflite_path) else None,
    }
