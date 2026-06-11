/**
 * ECG Simulator — 8-channel ADS1298 simulation generating 12 standard leads
 * Channels map to Einthoven + Wilson electrode placement:
 *   CH1=I, CH2=II, CH3=V1, CH4=V2, CH5=V3, CH6=V4, CH7=V5, CH8=V6
 * Derived leads: III=II-I, aVR=-(I+II)/2, aVL=I-II/2, aVF=II-I/2
 *
 * Will be replaced by real BLE data from Horizon Medical HRZ device (ADS1298)
 */

export const SAMPLE_RATE = 250;
export const NUM_CHANNELS = 8;

export const LEAD_NAMES = [
  'I', 'II', 'III', 'aVR', 'aVL', 'aVF',
  'V1', 'V2', 'V3', 'V4', 'V5', 'V6',
] as const;

export type LeadName = typeof LEAD_NAMES[number];

export interface ECGDataPoint {
  time: number;
  value: number;
}

export interface MultiLeadSample {
  time: number;
  channels: number[]; // 8 raw ADS1298 channels
  leads: Record<LeadName, number>; // 12 computed leads
}

const BEAT_DURATION = 0.8; // ~75 BPM baseline

/** Lead-specific amplitude & morphology multipliers */
const LEAD_PROFILE: Record<LeadName, { pAmp: number; rAmp: number; sAmp: number; tAmp: number; axis: number }> = {
  I:   { pAmp: 0.12, rAmp: 0.70, sAmp: -0.10, tAmp: 0.20, axis: 0 },
  II:  { pAmp: 0.15, rAmp: 1.00, sAmp: -0.20, tAmp: 0.25, axis: 60 },
  III: { pAmp: 0.08, rAmp: 0.55, sAmp: -0.15, tAmp: 0.12, axis: 120 },
  aVR: { pAmp: -0.10, rAmp: -0.50, sAmp: 0.08, tAmp: -0.15, axis: -150 },
  aVL: { pAmp: 0.06, rAmp: 0.40, sAmp: -0.05, tAmp: 0.10, axis: -30 },
  aVF: { pAmp: 0.10, rAmp: 0.75, sAmp: -0.18, tAmp: 0.18, axis: 90 },
  V1:  { pAmp: 0.08, rAmp: 0.30, sAmp: -0.80, tAmp: -0.10, axis: 0 },
  V2:  { pAmp: 0.10, rAmp: 0.45, sAmp: -0.60, tAmp: 0.15, axis: 0 },
  V3:  { pAmp: 0.10, rAmp: 0.70, sAmp: -0.35, tAmp: 0.20, axis: 0 },
  V4:  { pAmp: 0.12, rAmp: 0.90, sAmp: -0.15, tAmp: 0.25, axis: 0 },
  V5:  { pAmp: 0.12, rAmp: 0.80, sAmp: -0.10, tAmp: 0.22, axis: 0 },
  V6:  { pAmp: 0.10, rAmp: 0.65, sAmp: -0.05, tAmp: 0.18, axis: 0 },
};

function generateLeadPQRST(t: number, lead: LeadName): number {
  const profile = LEAD_PROFILE[lead];
  const phase = (t % BEAT_DURATION) / BEAT_DURATION;
  let v = 0;

  // P wave
  if (phase >= 0.05 && phase < 0.15) {
    const p = (phase - 0.05) / 0.1;
    v = profile.pAmp * Math.sin(p * Math.PI);
  }
  // Q wave
  if (phase >= 0.20 && phase < 0.24) {
    const q = (phase - 0.20) / 0.04;
    v = (profile.sAmp * 0.3) * Math.sin(q * Math.PI);
  }
  // R wave
  if (phase >= 0.24 && phase < 0.32) {
    const r = (phase - 0.24) / 0.08;
    v = profile.rAmp * Math.sin(r * Math.PI);
  }
  // S wave
  if (phase >= 0.32 && phase < 0.38) {
    const s = (phase - 0.32) / 0.06;
    v = profile.sAmp * Math.sin(s * Math.PI);
  }
  // ST segment
  if (phase >= 0.38 && phase < 0.48) {
    v = 0.02 * Math.sign(profile.tAmp);
  }
  // T wave
  if (phase >= 0.48 && phase < 0.65) {
    const tw = (phase - 0.48) / 0.17;
    v = profile.tAmp * Math.sin(tw * Math.PI);
  }

  // Noise
  v += (Math.random() - 0.5) * 0.015;
  return v;
}

export class ECGSimulator {
  private time = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: ((samples: MultiLeadSample[]) => void)[] = [];
  private _bpm = 75;
  private _isRunning = false;

  get bpm(): number { return this._bpm; }
  get isRunning(): boolean { return this._isRunning; }

  setBPM(bpm: number) {
    this._bpm = Math.max(40, Math.min(200, bpm));
  }

  onData(listener: (samples: MultiLeadSample[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this.time = 0;

    const BATCH_SIZE = 10;
    const INTERVAL_MS = (BATCH_SIZE / SAMPLE_RATE) * 1000;

    this.intervalId = setInterval(() => {
      const beatDuration = 60 / this._bpm;
      const samples: MultiLeadSample[] = [];

      for (let i = 0; i < BATCH_SIZE; i++) {
        const phase = (this.time % beatDuration) / beatDuration;
        const normalizedTime = phase * BEAT_DURATION;

        // Generate all 12 leads
        const leads = {} as Record<LeadName, number>;
        for (const name of LEAD_NAMES) {
          leads[name] = generateLeadPQRST(normalizedTime, name);
        }

        // Raw 8 channels: I, II, V1-V6
        const channels = [
          leads['I'], leads['II'],
          leads['V1'], leads['V2'], leads['V3'],
          leads['V4'], leads['V5'], leads['V6'],
        ];

        samples.push({ time: this.time, channels, leads });
        this.time += 1 / SAMPLE_RATE;
      }

      // Slight BPM variation
      if (Math.random() < 0.05) {
        this._bpm = this._bpm + (Math.random() - 0.5) * 2;
        this._bpm = Math.max(60, Math.min(100, this._bpm));
      }

      for (const listener of this.listeners) {
        listener(samples);
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
