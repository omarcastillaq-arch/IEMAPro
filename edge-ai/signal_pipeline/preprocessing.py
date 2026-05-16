"""
Horizon Medical - ECG Signal Preprocessing Pipeline
=====================================================
1D signal preprocessing for raw ECG data from the ADS1298 AFE.

Stages:
  1. ADC-to-voltage conversion (24-bit → mV)
  2. Bandpass filtering (0.5–45 Hz Butterworth)
  3. Powerline notch filter (50/60 Hz)
  4. Baseline wander removal (median filter)
  5. Z-score / min-max / robust normalization
  6. Beat segmentation (fixed-window or R-peak centred)
"""

import numpy as np
from scipy import signal as scipy_signal
from typing import List, Tuple, Optional
import logging

from .configs import config

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
#  ADC Conversion
# ──────────────────────────────────────────────────────────────
def adc_to_millivolts(
    raw_samples: np.ndarray,
    vref_mv: float = config.ADC_VREF_MV,
    gain: int = config.ADC_GAIN,
    bits: int = config.ADC_RESOLUTION_BITS,
) -> np.ndarray:
    """Convert 24-bit signed ADC counts to millivolts.

    Formula: voltage_mV = (raw / 2^(bits-1)) * (Vref / gain)
    """
    max_code = 2 ** (bits - 1)
    samples = np.asarray(raw_samples, dtype=np.float64)
    return (samples / max_code) * (vref_mv / gain)


# ──────────────────────────────────────────────────────────────
#  Filtering
# ──────────────────────────────────────────────────────────────
def bandpass_filter(
    sig: np.ndarray,
    low_hz: float = config.BANDPASS_LOW_HZ,
    high_hz: float = config.BANDPASS_HIGH_HZ,
    fs: int = config.SAMPLING_RATE_HZ,
    order: int = config.FILTER_ORDER,
) -> np.ndarray:
    """Apply Butterworth bandpass filter to remove baseline wander
    and high-frequency noise."""
    nyq = 0.5 * fs
    low = low_hz / nyq
    high = high_hz / nyq
    b, a = scipy_signal.butter(order, [low, high], btype="band")
    return scipy_signal.filtfilt(b, a, sig, axis=-1).astype(np.float32)


def notch_filter(
    sig: np.ndarray,
    freq_hz: float = config.NOTCH_FREQ_HZ,
    q: float = config.NOTCH_Q_FACTOR,
    fs: int = config.SAMPLING_RATE_HZ,
) -> np.ndarray:
    """Remove powerline interference (50/60 Hz) with a notch filter."""
    b, a = scipy_signal.iirnotch(freq_hz, q, fs)
    return scipy_signal.filtfilt(b, a, sig, axis=-1).astype(np.float32)


def remove_baseline_wander(
    sig: np.ndarray,
    window_ms: int = 600,
    fs: int = config.SAMPLING_RATE_HZ,
) -> np.ndarray:
    """Remove baseline wander using a median filter (two-pass)."""
    window_samples = int((window_ms / 1000.0) * fs)
    if window_samples % 2 == 0:
        window_samples += 1  # median filter needs odd window
    baseline = scipy_signal.medfilt(sig, kernel_size=window_samples)
    return (sig - baseline).astype(np.float32)


# ──────────────────────────────────────────────────────────────
#  Normalization
# ──────────────────────────────────────────────────────────────
def normalize(
    sig: np.ndarray,
    method: str = config.NORMALIZATION_METHOD,
) -> np.ndarray:
    """Normalize ECG signal.

    Methods:
        z-score : (x - mean) / std
        min-max : (x - min) / (max - min)
        robust  : (x - median) / IQR
    """
    sig = sig.astype(np.float32)
    if method == "z-score":
        mu = np.mean(sig)
        std = np.std(sig)
        if std < 1e-8:
            logger.warning("Near-zero std in normalization; returning zeros.")
            return np.zeros_like(sig)
        return (sig - mu) / std

    elif method == "min-max":
        mn, mx = np.min(sig), np.max(sig)
        rng = mx - mn
        if rng < 1e-8:
            return np.zeros_like(sig)
        return (sig - mn) / rng

    elif method == "robust":
        q25, q75 = np.percentile(sig, [25, 75])
        iqr = q75 - q25
        if iqr < 1e-8:
            return np.zeros_like(sig)
        return (sig - np.median(sig)) / iqr

    else:
        raise ValueError(f"Unknown normalization method: {method}")


# ──────────────────────────────────────────────────────────────
#  Segmentation
# ──────────────────────────────────────────────────────────────
def segment_fixed_window(
    sig: np.ndarray,
    segment_len: int = config.SEGMENT_SAMPLES,
    overlap_ratio: float = config.SEGMENT_OVERLAP_RATIO,
) -> np.ndarray:
    """Slice a long ECG signal into fixed-length overlapping windows.

    Returns: np.ndarray of shape (num_segments, segment_len)
    """
    step = int(segment_len * (1 - overlap_ratio))
    if step < 1:
        step = 1

    segments = []
    for start in range(0, len(sig) - segment_len + 1, step):
        segments.append(sig[start : start + segment_len])

    if len(segments) == 0:
        # Pad short signals
        padded = np.zeros(segment_len, dtype=np.float32)
        padded[: len(sig)] = sig[: segment_len]
        segments.append(padded)

    return np.array(segments, dtype=np.float32)


def segment_around_rpeaks(
    sig: np.ndarray,
    rpeak_indices: np.ndarray,
    window_before: int = 100,
    window_after: int = 150,
    target_len: int = config.SEGMENT_SAMPLES,
) -> np.ndarray:
    """Extract beat-centred segments around detected R-peaks.

    Each segment is zero-padded/truncated to target_len.
    """
    segments = []
    for idx in rpeak_indices:
        start = max(0, idx - window_before)
        end = min(len(sig), idx + window_after)
        beat = sig[start:end]
        if len(beat) < target_len:
            padded = np.zeros(target_len, dtype=np.float32)
            padded[: len(beat)] = beat
            beat = padded
        else:
            beat = beat[:target_len]
        segments.append(beat)

    return np.array(segments, dtype=np.float32) if segments else np.empty((0, target_len), dtype=np.float32)


def detect_rpeaks_simple(
    sig: np.ndarray,
    fs: int = config.SAMPLING_RATE_HZ,
    min_distance_ms: int = 200,
) -> np.ndarray:
    """Simple R-peak detection using scipy peak-finding on squared derivative.

    For production, consider Pan-Tompkins or Hamilton algorithms.
    """
    # Differentiate and square
    diff_sig = np.diff(sig)
    squared = diff_sig ** 2

    # Smooth with moving average (150 ms window)
    window = int(0.15 * fs)
    if window < 1:
        window = 1
    kernel = np.ones(window) / window
    smoothed = np.convolve(squared, kernel, mode="same")

    # Find peaks
    min_dist_samples = int((min_distance_ms / 1000.0) * fs)
    threshold = np.mean(smoothed) + 0.5 * np.std(smoothed)
    peaks, _ = scipy_signal.find_peaks(
        smoothed, height=threshold, distance=min_dist_samples
    )
    return peaks


# ──────────────────────────────────────────────────────────────
#  Full Preprocessing Pipeline
# ──────────────────────────────────────────────────────────────
def preprocess_signal(
    raw_signal: np.ndarray,
    fs: int = config.SAMPLING_RATE_HZ,
    convert_adc: bool = False,
    apply_notch: bool = True,
    apply_baseline_removal: bool = True,
    normalize_method: Optional[str] = config.NORMALIZATION_METHOD,
) -> np.ndarray:
    """Full preprocessing pipeline for a single-channel ECG signal.

    Args:
        raw_signal: 1D array of raw ECG samples.
        fs: Sampling rate in Hz.
        convert_adc: Whether to convert from ADC counts to mV.
        apply_notch: Apply powerline notch filter.
        apply_baseline_removal: Remove baseline wander.
        normalize_method: Normalization method (None to skip).

    Returns:
        Preprocessed 1D signal (float32).
    """
    sig = np.asarray(raw_signal, dtype=np.float64)

    # Step 1: ADC conversion (if raw counts from ADS1298)
    if convert_adc:
        sig = adc_to_millivolts(sig)

    # Step 2: Bandpass filter
    sig = bandpass_filter(sig, fs=fs)

    # Step 3: Notch filter
    if apply_notch:
        sig = notch_filter(sig, fs=fs)

    # Step 4: Baseline wander removal
    if apply_baseline_removal:
        sig = remove_baseline_wander(sig, fs=fs)

    # Step 5: Normalize
    if normalize_method:
        sig = normalize(sig, method=normalize_method)

    return sig.astype(np.float32)


def preprocess_and_segment(
    raw_signal: np.ndarray,
    fs: int = config.SAMPLING_RATE_HZ,
    segment_len: int = config.SEGMENT_SAMPLES,
    overlap: float = config.SEGMENT_OVERLAP_RATIO,
    convert_adc: bool = False,
) -> np.ndarray:
    """Preprocess a raw signal and segment into fixed windows.

    Returns: np.ndarray of shape (num_segments, segment_len, 1)
             ready for CNN-LSTM input.
    """
    clean = preprocess_signal(raw_signal, fs=fs, convert_adc=convert_adc)
    segments = segment_fixed_window(clean, segment_len=segment_len, overlap_ratio=overlap)
    # Add channel dimension for Conv1D
    return segments[..., np.newaxis]


# ──────────────────────────────────────────────────────────────
#  Utility: Quick Validation
# ──────────────────────────────────────────────────────────────
def validate_signal(sig: np.ndarray, fs: int = config.SAMPLING_RATE_HZ) -> dict:
    """Quick quality check on an ECG signal segment."""
    duration_sec = len(sig) / fs
    rpeaks = detect_rpeaks_simple(sig, fs=fs)
    hr = len(rpeaks) / duration_sec * 60 if duration_sec > 0 else 0
    snr_db = 10 * np.log10(np.var(sig) / (np.var(np.diff(sig)) + 1e-12))

    return {
        "duration_sec": round(duration_sec, 2),
        "num_samples": len(sig),
        "heart_rate_bpm": round(hr, 1),
        "num_rpeaks": len(rpeaks),
        "snr_db": round(float(snr_db), 2),
        "mean": round(float(np.mean(sig)), 6),
        "std": round(float(np.std(sig)), 6),
        "quality_ok": 30 < hr < 220 and float(snr_db) > 5,
    }
