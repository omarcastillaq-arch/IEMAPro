"""
Horizon Medical - ECG Data Loader
===================================
Load and prepare ECG data for training, supporting:
  1. MIT-BIH Arrhythmia Database (via wfdb)
  2. Synthetic data generation for testing
  3. Raw Holter device data (from MongoDB / CSV)
"""

import numpy as np
import os
import json
import logging
from typing import Tuple, Optional
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight

from .configs import config
from .preprocessing import preprocess_signal

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
#  MIT-BIH Arrhythmia Database Loader
# ──────────────────────────────────────────────────────────────
def load_mitbih_data(
    data_dir: Optional[str] = None,
    max_records: Optional[int] = None,
    beat_window_before: int = 90,
    beat_window_after: int = 160,
) -> Tuple[np.ndarray, np.ndarray]:
    """Load and preprocess MIT-BIH Arrhythmia Database.

    Uses wfdb to download/read records. Extracts individual beats
    centered on annotated R-peaks and maps to AAMI classes.

    Args:
        data_dir: Directory to cache downloaded records.
        max_records: Limit number of records (for quick testing).
        beat_window_before: Samples before R-peak.
        beat_window_after: Samples after R-peak.

    Returns:
        (X, y): X shape (n_beats, target_len, 1), y shape (n_beats,)
    """
    try:
        import wfdb
    except ImportError:
        raise ImportError("wfdb package required: pip install wfdb")

    if data_dir is None:
        data_dir = os.path.join(config.DATA_DIR, "mitbih")
    os.makedirs(data_dir, exist_ok=True)

    # MIT-BIH record numbers
    record_nums = [
        100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
        111, 112, 113, 114, 115, 116, 117, 118, 119, 121,
        122, 123, 124, 200, 201, 202, 203, 205, 207, 208,
        209, 210, 212, 213, 214, 215, 217, 219, 220, 221,
        222, 223, 228, 230, 231, 232, 233, 234,
    ]

    if max_records:
        record_nums = record_nums[:max_records]

    target_len = beat_window_before + beat_window_after
    all_beats = []
    all_labels = []

    for rec_num in record_nums:
        rec_name = str(rec_num)
        try:
            # Download if not cached
            rec_path = os.path.join(data_dir, rec_name)
            if not os.path.exists(rec_path + ".dat"):
                logger.info(f"Downloading MIT-BIH record {rec_name}...")
                wfdb.dl_database("mitdb", dl_dir=data_dir, records=[rec_name])

            # Read record (Lead II = channel 0 for most records)
            record = wfdb.rdrecord(rec_path, channels=[0])
            annotation = wfdb.rdann(rec_path, "atr")

            sig = record.p_signal[:, 0].astype(np.float64)
            fs = record.fs

            # Preprocess the full record
            sig_clean = preprocess_signal(sig, fs=fs, convert_adc=False)

            # Extract beats at annotation locations
            for idx, symbol in zip(annotation.sample, annotation.symbol):
                if symbol not in config.AAMI_MAPPING:
                    continue

                label = config.AAMI_MAPPING[symbol]
                start = idx - beat_window_before
                end = idx + beat_window_after

                if start < 0 or end > len(sig_clean):
                    continue

                beat = sig_clean[start:end]
                if len(beat) == target_len:
                    all_beats.append(beat)
                    all_labels.append(label)

            logger.info(
                f"Record {rec_name}: extracted {len(annotation.sample)} annotations"
            )

        except Exception as e:
            logger.warning(f"Error loading record {rec_name}: {e}")
            continue

    if not all_beats:
        raise RuntimeError("No beats extracted from MIT-BIH database.")

    X = np.array(all_beats, dtype=np.float32)
    y = np.array(all_labels, dtype=np.int32)

    # Pad or truncate to model input length
    if target_len != config.MODEL_INPUT_LENGTH:
        X_padded = np.zeros((len(X), config.MODEL_INPUT_LENGTH), dtype=np.float32)
        copy_len = min(target_len, config.MODEL_INPUT_LENGTH)
        X_padded[:, :copy_len] = X[:, :copy_len]
        X = X_padded

    # Add channel dimension
    X = X[..., np.newaxis]

    logger.info(f"Total beats: {len(X)}, Class distribution: {dict(zip(*np.unique(y, return_counts=True)))}")
    return X, y


# ──────────────────────────────────────────────────────────────
#  Synthetic Data Generator (for testing / demo)
# ──────────────────────────────────────────────────────────────
def generate_synthetic_ecg(
    n_samples: int = 5000,
    segment_len: int = config.MODEL_INPUT_LENGTH,
    num_classes: int = config.NUM_CLASSES,
    fs: int = config.SAMPLING_RATE_HZ,
    seed: int = config.RANDOM_SEED,
) -> Tuple[np.ndarray, np.ndarray]:
    """Generate synthetic ECG-like signals for pipeline testing.

    Creates realistic-ish waveforms with different morphologies
    for each arrhythmia class.

    Returns:
        (X, y): X shape (n_samples, segment_len, 1), y integer labels.
    """
    rng = np.random.RandomState(seed)
    X = np.zeros((n_samples, segment_len, 1), dtype=np.float32)
    y = rng.randint(0, num_classes, size=n_samples).astype(np.int32)

    t = np.linspace(0, segment_len / fs, segment_len)

    for i in range(n_samples):
        cls = y[i]
        # Base sinus rhythm
        hr = 60 + rng.randn() * 10  # 60 ± 10 BPM
        freq = hr / 60.0

        # P-wave
        p_wave = 0.15 * np.sin(2 * np.pi * freq * t)
        # QRS complex
        qrs_width_factor = 1.0
        qrs_amp = 1.0

        if cls == 0:  # Normal
            qrs_amp = 1.0 + rng.randn() * 0.1
        elif cls == 1:  # SVEB - narrower QRS, abnormal P
            qrs_amp = 0.8 + rng.randn() * 0.1
            p_wave *= 1.5  # Abnormal P-wave
        elif cls == 2:  # VEB - wider QRS, no P
            qrs_amp = 1.5 + rng.randn() * 0.2
            qrs_width_factor = 1.5
            p_wave *= 0.1
        elif cls == 3:  # Fusion - mixed morphology
            qrs_amp = 1.2 + rng.randn() * 0.15
            qrs_width_factor = 1.2
        elif cls == 4:  # Unknown - noisy
            qrs_amp = 0.5 + rng.randn() * 0.3

        # Build QRS
        qrs = qrs_amp * np.exp(-0.5 * ((t - 0.5 / freq) / (0.02 * qrs_width_factor)) ** 2)
        # T-wave
        t_wave = 0.3 * np.sin(2 * np.pi * freq * 0.5 * t + np.pi / 4)
        # Combine
        ecg = p_wave + qrs + t_wave
        # Repeat for full segment
        period_samples = int(fs / freq)
        if period_samples > 0:
            full_ecg = np.tile(ecg[:period_samples], segment_len // period_samples + 1)[:segment_len]
        else:
            full_ecg = ecg

        # Add noise
        noise = rng.randn(segment_len) * 0.05
        full_ecg += noise

        X[i, :, 0] = full_ecg.astype(np.float32)

    logger.info(f"Generated {n_samples} synthetic ECG segments across {num_classes} classes")
    return X, y


# ──────────────────────────────────────────────────────────────
#  Data Preparation Utilities
# ──────────────────────────────────────────────────────────────
def prepare_datasets(
    X: np.ndarray,
    y: np.ndarray,
    val_split: float = config.VALIDATION_SPLIT,
    test_split: float = config.TEST_SPLIT,
    seed: int = config.RANDOM_SEED,
) -> dict:
    """Split data into train/val/test and compute class weights.

    Returns dict with keys: X_train, y_train, X_val, y_val, X_test, y_test,
                            class_weights, label_counts
    """
    num_classes = config.NUM_CLASSES

    # One-hot encode labels
    y_onehot = np.eye(num_classes, dtype=np.float32)[y]

    # Split: first take out test set, then split remainder into train/val
    X_temp, X_test, y_temp, y_test, y_int_temp, y_int_test = train_test_split(
        X, y_onehot, y, test_size=test_split, random_state=seed, stratify=y
    )

    val_ratio = val_split / (1 - test_split)
    X_train, X_val, y_train, y_val, y_int_train, _ = train_test_split(
        X_temp, y_temp, y_int_temp, test_size=val_ratio, random_state=seed, stratify=y_int_temp
    )

    # Class weights for imbalanced data
    class_weights = None
    if config.USE_CLASS_WEIGHTS:
        unique_classes = np.unique(y)
        weights = compute_class_weight("balanced", classes=unique_classes, y=y)
        class_weights = dict(zip(unique_classes.astype(int), weights))

    # Label distribution
    unique, counts = np.unique(y, return_counts=True)
    label_counts = dict(zip([config.ARRHYTHMIA_CLASSES.get(int(u), str(u)) for u in unique], counts.tolist()))

    logger.info(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    logger.info(f"Class distribution: {label_counts}")

    return {
        "X_train": X_train,
        "y_train": y_train,
        "X_val": X_val,
        "y_val": y_val,
        "X_test": X_test,
        "y_test": y_test,
        "class_weights": class_weights,
        "label_counts": label_counts,
    }


def load_holter_csv(
    csv_path: str,
    channel: int = 0,
    fs: int = config.SAMPLING_RATE_HZ,
) -> np.ndarray:
    """Load raw ECG data from a CSV file (Holter device export).

    Expected format: each row is a sample, each column is a channel.
    """
    data = np.loadtxt(csv_path, delimiter=",", dtype=np.float64)
    if data.ndim == 1:
        return data
    return data[:, channel]
