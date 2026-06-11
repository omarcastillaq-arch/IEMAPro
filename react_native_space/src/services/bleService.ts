/**
 * BLE Service for Horizon Medical HRZ ECG Device
 * 
 * This service handles Bluetooth Low Energy connection
 * to the HRZ electrocardiograph device.
 * 
 * Status: PREPARED — will be activated when device is available.
 * The HRZ device likely exposes:
 *   - Heart Rate Service (0x180D) for BPM
 *   - Custom ECG Service for raw waveform data
 */

import { Platform } from 'react-native';

export type ConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected';

export interface HRZDevice {
  id: string;
  name: string;
  rssi: number;
}

export interface BLECallbacks {
  onStatusChange?: (status: ConnectionStatus) => void;
  onDeviceFound?: (device: HRZDevice) => void;
  onECGData?: (samples: number[]) => void;
  onHeartRate?: (bpm: number) => void;
  onError?: (error: string) => void;
}

class BLEService {
  private status: ConnectionStatus = 'disconnected';
  private callbacks: BLECallbacks = {};
  private connectedDevice: HRZDevice | null = null;

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getConnectedDevice(): HRZDevice | null {
    return this.connectedDevice;
  }

  setCallbacks(cb: BLECallbacks) {
    this.callbacks = cb;
  }

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

    // TODO: Implement real BLE scanning when react-native-ble-plx is installed
    // For now, this is a placeholder that will be replaced with actual BLE code
    // when the HRZ device Bluetooth is activated
    
    // Simulated scan timeout
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
    // TODO: Real BLE connection
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
