/**
 * BLE Service for Horizon Medical HRZ ECG Device (ADS1298 — 8 channels)
 *
 * The HRZ device transmits 8 ECG channels via BLE characteristics:
 *   UUID 8171–8178 → CH1–CH8 (24-bit ADC)
 *   CH1=Lead I, CH2=Lead II, CH3–CH8=V1–V6
 *   Derived: III=II-I, aVR=-(I+II)/2, aVL=I-II/2, aVF=II-I/2
 *
 * Status: PREPARED — will be activated when device is available.
 */

import { Platform } from 'react-native';
import type { MultiLeadSample } from './ecgSimulator';

export type ConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected';

export interface HRZDevice {
  id: string;
  name: string;
  rssi: number;
}

export interface BLECallbacks {
  onStatusChange?: (status: ConnectionStatus) => void;
  onDeviceFound?: (device: HRZDevice) => void;
  onMultiLeadData?: (samples: MultiLeadSample[]) => void;
  onHeartRate?: (bpm: number) => void;
  onLeadOff?: (channels: boolean[]) => void;
  onError?: (error: string) => void;
}

// HRZ BLE Service UUIDs
export const HRZ_SERVICE_UUID = '00008170-0000-1000-8000-00805f9b34fb';
export const HRZ_CHANNEL_UUIDS = [
  '00008171-0000-1000-8000-00805f9b34fb', // CH1 (Lead I)
  '00008172-0000-1000-8000-00805f9b34fb', // CH2 (Lead II)
  '00008173-0000-1000-8000-00805f9b34fb', // CH3 (V1)
  '00008174-0000-1000-8000-00805f9b34fb', // CH4 (V2)
  '00008175-0000-1000-8000-00805f9b34fb', // CH5 (V3)
  '00008176-0000-1000-8000-00805f9b34fb', // CH6 (V4)
  '00008177-0000-1000-8000-00805f9b34fb', // CH7 (V5)
  '00008178-0000-1000-8000-00805f9b34fb', // CH8 (V6)
];

class BLEService {
  private status: ConnectionStatus = 'disconnected';
  private callbacks: BLECallbacks = {};
  private connectedDevice: HRZDevice | null = null;

  getStatus(): ConnectionStatus { return this.status; }
  getConnectedDevice(): HRZDevice | null { return this.connectedDevice; }

  setCallbacks(cb: BLECallbacks) { this.callbacks = cb; }

  private updateStatus(status: ConnectionStatus) {
    this.status = status;
    this.callbacks?.onStatusChange?.(status);
  }

  async startScan(): Promise<void> {
    if (Platform.OS === 'web') {
      this.callbacks?.onError?.('Bluetooth no disponible en web. Usa la app móvil.');
      return;
    }
    this.updateStatus('scanning');

    // TODO: Implement real BLE scanning with react-native-ble-plx
    // Will scan for devices advertising HRZ_SERVICE_UUID
    setTimeout(() => {
      if (this.status === 'scanning') {
        this.updateStatus('disconnected');
        this.callbacks?.onError?.('No se encontró el dispositivo HRZ. Asegúrate de que el Bluetooth esté activado.');
      }
    }, 10000);
  }

  async stopScan(): Promise<void> {
    this.updateStatus('disconnected');
  }

  async connect(device: HRZDevice): Promise<void> {
    this.updateStatus('connecting');
    // TODO: Real BLE connection — subscribe to all 8 channel characteristics
    this.connectedDevice = device;
    this.updateStatus('connected');
  }

  async disconnect(): Promise<void> {
    this.connectedDevice = null;
    this.updateStatus('disconnected');
  }

  destroy() {
    this.disconnect();
    this.callbacks = {};
  }
}

export const bleService = new BLEService();
