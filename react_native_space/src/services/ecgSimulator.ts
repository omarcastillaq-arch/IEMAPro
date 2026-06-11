/**
 * ECG Simulator — generates realistic PQRST waveform data
 * Will be replaced by real BLE data from Horizon Medical HRZ device
 */

export interface ECGDataPoint {
  time: number;
  value: number;
}

const SAMPLE_RATE = 250; // Hz (samples per second)
const BEAT_DURATION = 0.8; // seconds per beat (~75 BPM)

function generatePQRST(t: number): number {
  // Normalize t within a single heartbeat cycle (0 to 1)
  const phase = (t % BEAT_DURATION) / BEAT_DURATION;

  // Baseline
  let v = 0;

  // P wave (atrial depolarization) — small bump
  if (phase >= 0.05 && phase < 0.15) {
    const p = (phase - 0.05) / 0.1;
    v = 0.15 * Math.sin(p * Math.PI);
  }

  // PR segment (flat)
  // Q wave (small negative dip)
  if (phase >= 0.2 && phase < 0.24) {
    const q = (phase - 0.2) / 0.04;
    v = -0.1 * Math.sin(q * Math.PI);
  }

  // R wave (tall spike — ventricular depolarization)
  if (phase >= 0.24 && phase < 0.32) {
    const r = (phase - 0.24) / 0.08;
    v = 1.0 * Math.sin(r * Math.PI);
  }

  // S wave (negative dip after R)
  if (phase >= 0.32 && phase < 0.38) {
    const s = (phase - 0.32) / 0.06;
    v = -0.2 * Math.sin(s * Math.PI);
  }

  // ST segment (slightly elevated)
  if (phase >= 0.38 && phase < 0.48) {
    v = 0.02;
  }

  // T wave (ventricular repolarization)
  if (phase >= 0.48 && phase < 0.65) {
    const tw = (phase - 0.48) / 0.17;
    v = 0.25 * Math.sin(tw * Math.PI);
  }

  // Add slight noise for realism
  v += (Math.random() - 0.5) * 0.02;

  return v;
}

export class ECGSimulator {
  private time = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: ((points: ECGDataPoint[]) => void)[] = [];
  private _bpm = 75;
  private _isRunning = false;

  get bpm(): number {
    return this._bpm;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  setBPM(bpm: number) {
    this._bpm = Math.max(40, Math.min(200, bpm));
  }

  onData(listener: (points: ECGDataPoint[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this.time = 0;

    const BATCH_SIZE = 10; // send 10 samples at ~40ms interval = 250 Hz
    const INTERVAL_MS = (BATCH_SIZE / SAMPLE_RATE) * 1000;

    this.intervalId = setInterval(() => {
      const beatDuration = 60 / this._bpm;
      const points: ECGDataPoint[] = [];

      for (let i = 0; i < BATCH_SIZE; i++) {
        const phase = (this.time % beatDuration) / beatDuration;
        // Use beatDuration-adjusted PQRST
        const normalizedTime = phase * BEAT_DURATION;
        const value = generatePQRST(normalizedTime);
        points.push({ time: this.time, value });
        this.time += 1 / SAMPLE_RATE;
      }

      // Vary BPM slightly for realism
      if (Math.random() < 0.05) {
        this._bpm = this._bpm + (Math.random() - 0.5) * 2;
        this._bpm = Math.max(60, Math.min(100, this._bpm));
      }

      for (const listener of this.listeners) {
        listener(points);
      }
    }, INTERVAL_MS);
  }

  stop() {
    this._isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  destroy() {
    this.stop();
    this.listeners = [];
  }
}

export const ecgSimulator = new ECGSimulator();
