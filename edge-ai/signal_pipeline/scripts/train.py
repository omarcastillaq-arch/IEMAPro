#!/usr/bin/env python3
"""
Horizon Medical - ECG Model Training Script
=============================================
Train the CNN-LSTM model on raw 1D ECG signals.

Usage:
    python -m signal_pipeline.scripts.train [--synthetic] [--epochs N] [--batch-size N]

Options:
    --synthetic     Use synthetic data instead of MIT-BIH (for quick testing)
    --mitbih        Download and use MIT-BIH Arrhythmia Database
    --epochs N      Override number of training epochs
    --batch-size N  Override batch size
    --lightweight   Train the lightweight model (for Cortex-M)
"""

import os
import sys
import json
import argparse
import logging
import time
import numpy as np

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import tensorflow as tf
from tensorflow import keras

from signal_pipeline.configs import config
from signal_pipeline.model import (
    build_cnn_lstm_model,
    build_lightweight_model,
    compile_model,
    get_model_summary,
)
from signal_pipeline.data_loader import (
    generate_synthetic_ecg,
    load_mitbih_data,
    prepare_datasets,
)
from signal_pipeline.evaluate import evaluate_model, generate_evaluation_report

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def train(args):
    """Main training function."""
    start_time = time.time()
    logger.info("=" * 60)
    logger.info("Horizon Medical - ECG CNN-LSTM Training")
    logger.info("=" * 60)

    # ── 1. Load Data ──
    logger.info("\n📊 Loading data...")
    if args.synthetic:
        logger.info("Using SYNTHETIC data for pipeline testing")
        X, y = generate_synthetic_ecg(
            n_samples=args.n_samples,
            segment_len=config.MODEL_INPUT_LENGTH,
        )
    elif args.mitbih:
        logger.info("Using MIT-BIH Arrhythmia Database")
        X, y = load_mitbih_data(max_records=args.max_records)
    else:
        logger.info("Using SYNTHETIC data (default - use --mitbih for real data)")
        X, y = generate_synthetic_ecg(
            n_samples=args.n_samples,
            segment_len=config.MODEL_INPUT_LENGTH,
        )

    logger.info(f"Data shape: X={X.shape}, y={y.shape}")

    # ── 2. Prepare Datasets ──
    logger.info("\n🔀 Splitting into train/val/test...")
    datasets = prepare_datasets(X, y)

    logger.info(f"Train: {datasets['X_train'].shape[0]} samples")
    logger.info(f"Val:   {datasets['X_val'].shape[0]} samples")
    logger.info(f"Test:  {datasets['X_test'].shape[0]} samples")
    logger.info(f"Class weights: {datasets['class_weights']}")

    # ── 3. Build Model ──
    logger.info("\n🏗️  Building model...")
    if args.lightweight:
        model = build_lightweight_model(
            input_length=config.MODEL_INPUT_LENGTH,
            num_classes=config.NUM_CLASSES,
        )
        logger.info("Using LIGHTWEIGHT model (for constrained edge devices)")
    else:
        model = build_cnn_lstm_model(
            input_length=config.MODEL_INPUT_LENGTH,
            input_channels=config.MODEL_INPUT_CHANNELS,
            num_classes=config.NUM_CLASSES,
        )
        logger.info("Using CNN-LSTM model")

    model = compile_model(model, learning_rate=args.learning_rate)
    model.summary(print_fn=logger.info)

    summary = get_model_summary(model)
    logger.info(f"Model parameters: {summary['total_params']:,}")
    logger.info(f"Estimated size (float32): {summary['estimated_size_mb']:.3f} MB")

    # ── 4. Callbacks ──
    os.makedirs(config.MODEL_SAVE_DIR, exist_ok=True)

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=config.EARLY_STOPPING_PATIENCE,
            restore_best_weights=True,
            verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=config.LR_REDUCE_FACTOR,
            patience=config.LR_REDUCE_PATIENCE,
            min_lr=1e-7,
            verbose=1,
        ),
        keras.callbacks.ModelCheckpoint(
            filepath=config.MODEL_KERAS_PATH,
            monitor="val_loss",
            save_best_only=True,
            verbose=1,
        ),
    ]

    # ── 5. Train ──
    logger.info(f"\n🚀 Training for {args.epochs} epochs (batch_size={args.batch_size})...")
    history = model.fit(
        datasets["X_train"],
        datasets["y_train"],
        validation_data=(datasets["X_val"], datasets["y_val"]),
        epochs=args.epochs,
        batch_size=args.batch_size,
        class_weight=datasets["class_weights"],
        callbacks=callbacks,
        verbose=1,
    )

    # ── 6. Save Training History ──
    history_data = {
        k: [float(v) for v in vals] for k, vals in history.history.items()
    }
    history_data["training_time_sec"] = round(time.time() - start_time, 2)
    # Convert numpy types in summary for JSON serialization
    summary_serializable = {
        k: int(v) if isinstance(v, (np.integer,)) else
           float(v) if isinstance(v, (np.floating,)) else v
        for k, v in summary.items()
    }
    history_data["model_summary"] = summary_serializable

    with open(config.TRAINING_HISTORY_PATH, "w") as f:
        json.dump(history_data, f, indent=2)
    logger.info(f"Training history saved to {config.TRAINING_HISTORY_PATH}")

    # ── 7. Evaluate on Test Set ──
    logger.info("\n📈 Evaluating on test set...")
    metrics = evaluate_model(
        model,
        datasets["X_test"],
        datasets["y_test"],
    )
    report = generate_evaluation_report(metrics)
    logger.info(f"\n{report}")

    # Save metrics
    with open(config.METRICS_REPORT_PATH, "w") as f:
        json.dump(metrics, f, indent=2, default=str)
    logger.info(f"Metrics saved to {config.METRICS_REPORT_PATH}")

    # ── 8. Save Final Model ──
    model.save(config.MODEL_KERAS_PATH)
    logger.info(f"Model saved to {config.MODEL_KERAS_PATH}")

    total_time = time.time() - start_time
    logger.info(f"\n✅ Training complete in {total_time:.1f}s")

    return model, history, metrics


def parse_args():
    parser = argparse.ArgumentParser(description="Train ECG CNN-LSTM model")
    parser.add_argument("--synthetic", action="store_true", help="Use synthetic data")
    parser.add_argument("--mitbih", action="store_true", help="Use MIT-BIH database")
    parser.add_argument("--epochs", type=int, default=config.EPOCHS)
    parser.add_argument("--batch-size", type=int, default=config.BATCH_SIZE)
    parser.add_argument("--learning-rate", type=float, default=config.LEARNING_RATE)
    parser.add_argument("--lightweight", action="store_true", help="Use lightweight model")
    parser.add_argument("--n-samples", type=int, default=5000, help="Synthetic samples count")
    parser.add_argument("--max-records", type=int, default=None, help="Max MIT-BIH records")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    train(args)
