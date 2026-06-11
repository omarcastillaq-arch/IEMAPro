/**
 * BLE Service for Horizon Medical HRZ ECG Device (ADS1298 — 8 channels)
 *
 * The HRZ device transmits 8 ECG channels via BLE:
 *   Service UUID: 8170
 *   Characteristics 8171–8178 → CH1–CH8 (24-bit ADC samples)
 *   CH1=Lead I, CH2=Lead II, CH3–CH8=V1–V6
 *   Derived: III=II-I, aVR=-(I+II)/2, aVL=I-II/2, aVF=II-I/2
 */

import { Platform } from 'react-native';
import { LEAD_NAMES, SAMPLE_RATE, type LeadName, type MultiLeadSample } from './ecgSimulator';

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

// HRZ BLE UUIDs
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

// Device name patterns to identify HRZ devices
const HRZ_NAME_PATTERNS = ['HRZ', 'Horizon', 'HM-H100', 'HorizonMedical'];

let BleManager: any = null;

/** Lazily load react-native-ble-plx (unavailable on web) */
function getBleManager() {
  if (Platform.OS === 'web') return null;
  if (!BleManager) {
    try {
      const blePlx = require('react-native-ble-plx');
      BleManager = new blePlx.BleManager();
    } catch (e) {
      console.warn('react-native-ble-plx not available:', e);
      return null;
    }
  }
  return BleManager;
}

/** Parse ADS1298 24-bit signed samples from BLE characteristic value (base64) */
function parse24BitSamples(base64Value: string): number[] {
  try {
    // Decode base64 to byte array
    const raw = atob(base64Value);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }

    const samples: number[] = [];
    // Each sample is 3 bytes (24-bit signed)
    for (let i = 0; i + 2 < bytes.length; i += 3) {
      let val = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      // Sign extend 24-bit to 32-bit
      if (val & 0x800000) val |= 0xFF000000;
      // Normalize to ±1 range (ADS1298 full scale ≈ ±2.4V with gain)
      // 24-bit range: -8388608 to 8388607
      samples.push(val / 8388607);
    }
    return samples;
  } catch {
    return [];
  }
}

class BLEService {
  private status: ConnectionStatus = 'disconnected';
  private callbacks: BLECallbacks = {};
  private connectedDevice: HRZDevice | null = null;
  private bleDevice: any = null; // BleManager Device instance
  private subscriptions: any[] = [];
  private channelBuffers: number[][] = Array.from({ length: 8 }, () => []);
  private sampleTime = 0;
  private discoveredDevices: Map<string, HRZDevice> = new Map();

  getStatus(): ConnectionStatus { return this.status; }
  getConnectedDevice(): HRZDevice | null { return this.connectedDevice; }
  getDiscoveredDevices(): HRZDevice[] { return Array.from(this.discoveredDevices.values()); }

  setCallbacks(cb: BLECallbacks) { this.callbacks = cb; }

  private updateStatus(status: ConnectionStatus) {
    this.status = status;
    this.callbacks?.onStatusChange?.(status);
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      if (Platform.OS === 'android') {
        const { PermissionsAndroid } = require('react-native');
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return Object.values(results).every(
          (r: any) => r === PermissionsAndroid.RESULTS.GRANTED
        );
      }
      // iOS permissions are handled by Info.plist
      return true;
    } catch {
      return false;
    }
  }

  async startScan(): Promise<void> {
    if (Platform.OS === 'web') {
      this.callbacks?.onError?.('Bluetooth no disponible en web. Usa la app móvil con Expo Go.');
      return;
    }

    const manager = getBleManager();
    if (!manager) {
      this.callbacks?.onError?.('BLE no disponible en este dispositivo.');
      return;
    }

    const hasPerms = await this.requestPermissions();
    if (!hasPerms) {
      this.callbacks?.onError?.('Permisos de Bluetooth denegados. Actívalos en Configuración.');
      return;
    }

    // Check BLE state
    const state = await manager.state();
    if (state !== 'PoweredOn') {
      this.callbacks?.onError?.('Bluetooth está apagado. Por favor actívalo.');
      return;
    }

    this.updateStatus('scanning');
    this.discoveredDevices.clear();

    manager.startDeviceScan(
      [HRZ_SERVICE_UUID], // Filter by HRZ service UUID
      { allowDuplicates: false },
      (error: any, device: any) => {
        if (error) {
          console.error('BLE scan error:', error);
          // Don't stop on non-fatal errors
          if (error.errorCode === 600) {
            // Location services off
            this.callbacks?.onError?.('Activa la ubicación para escanear dispositivos BLE.');
            this.updateStatus('disconnected');
          }
          return;
        }

        if (!device) return;

        const name = device.name ?? device.localName ?? '';
        const isHRZ = HRZ_NAME_PATTERNS.some((p) => name.toUpperCase().includes(p.toUpperCase()));

        // Accept devices that match name OR advertise our service UUID
        if (name && (isHRZ || device.serviceUUIDs?.includes(HRZ_SERVICE_UUID))) {
          const hrzDevice: HRZDevice = {
            id: device.id,
            name: name || `HRZ-${device.id.slice(-4)}`,
            rssi: device.rssi ?? -100,
          };
          this.discoveredDevices.set(device.id, hrzDevice);
          this.callbacks?.onDeviceFound?.(hrzDevice);
        }
      }
    );

    // Auto-stop scan after 15 seconds
    setTimeout(() => {
      if (this.status === 'scanning') {
        this.stopScan();
        if (this.discoveredDevices.size === 0) {
          this.callbacks?.onError?.('No se encontró el dispositivo HRZ. Verifica que esté encendido y cerca.');
        }
      }
    }, 15000);
  }

  async stopScan(): Promise<void> {
    const manager = getBleManager();
    manager?.stopDeviceScan();
    if (this.status === 'scanning') {
      this.updateStatus('disconnected');
    }
  }

  async connect(device: HRZDevice): Promise<void> {
    const manager = getBleManager();
    if (!manager) {
      this.callbacks?.onError?.('BLE no disponible.');
      return;
    }

    try {
      this.updateStatus('connecting');
      await this.stopScan();

      // Connect to device
      this.bleDevice = await manager.connectToDevice(device.id, {
        requestMTU: 512, // Request larger MTU for ECG data throughput
        timeout: 10000,
      });

      // Discover services and characteristics
      await this.bleDevice.discoverAllServicesAndCharacteristics();

      this.connectedDevice = device;
      this.sampleTime = 0;
      this.channelBuffers = Array.from({ length: 8 }, () => []);

      // Subscribe to all 8 ECG channel characteristics
      await this.subscribeToChannels();

      this.updateStatus('connected');

      // Monitor disconnection
      manager.onDeviceDisconnected(device.id, (_error: any) => {
        this.handleDisconnection();
      });

    } catch (error: any) {
      console.error('BLE connect error:', error);
      this.callbacks?.onError?.(`Error al conectar: ${error?.message ?? 'desconocido'}`);
      this.updateStatus('disconnected');
      this.bleDevice = null;
    }
  }

  private async subscribeToChannels(): Promise<void> {
    if (!this.bleDevice) return;

    for (let ch = 0; ch < 8; ch++) {
      const charUUID = HRZ_CHANNEL_UUIDS[ch];
      try {
        const sub = this.bleDevice.monitorCharacteristicForService(
          HRZ_SERVICE_UUID,
          charUUID,
          (error: any, characteristic: any) => {
            if (error) {
              console.warn(`CH${ch + 1} monitor error:`, error.message);
              return;
            }
            if (characteristic?.value) {
              this.handleChannelData(ch, characteristic.value);
            }
          }
        );
        this.subscriptions.push(sub);
      } catch (e) {
        console.warn(`Failed to subscribe to CH${ch + 1}:`, e);
      }
    }
  }

  private handleChannelData(channelIndex: number, base64Value: string): void {
    const samples = parse24BitSamples(base64Value);
    if (samples.length === 0) return;

    const buf = this.channelBuffers[channelIndex];
    buf.push(...samples);

    // When all channels have data, assemble multi-lead samples
    const minLen = Math.min(...this.channelBuffers.map((b) => b.length));
    if (minLen > 0) {
      const multiSamples: MultiLeadSample[] = [];

      for (let i = 0; i < minLen; i++) {
        const ch = this.channelBuffers.map((b) => b[i] ?? 0);
        // Raw channels: [I, II, V1, V2, V3, V4, V5, V6]
        const leadI = ch[0];
        const leadII = ch[1];

        const leads: Record<LeadName, number> = {
          'I': leadI,
          'II': leadII,
          'III': leadII - leadI,
          'aVR': -(leadI + leadII) / 2,
          'aVL': leadI - leadII / 2,
          'aVF': leadII - leadI / 2,
          'V1': ch[2],
          'V2': ch[3],
          'V3': ch[4],
          'V4': ch[5],
          'V5': ch[6],
          'V6': ch[7],
        };

        multiSamples.push({
          time: this.sampleTime,
          channels: ch,
          leads,
        });
        this.sampleTime += 1 / SAMPLE_RATE;
      }

      // Remove consumed samples from buffers
      for (let c = 0; c < 8; c++) {
        this.channelBuffers[c] = this.channelBuffers[c].slice(minLen);
      }

      this.callbacks?.onMultiLeadData?.(multiSamples);
    }
  }

  private handleDisconnection(): void {
    this.cleanupSubscriptions();
    this.connectedDevice = null;
    this.bleDevice = null;
    this.updateStatus('disconnected');
    this.callbacks?.onError?.('Dispositivo HRZ desconectado.');
  }

  private cleanupSubscriptions(): void {
    for (const sub of this.subscriptions) {
      try { sub?.remove?.(); } catch { /* ignore */ }
    }
    this.subscriptions = [];
  }

  async disconnect(): Promise<void> {
    this.cleanupSubscriptions();
    if (this.bleDevice) {
      try {
        await this.bleDevice.cancelConnection();
      } catch { /* ignore if already disconnected */ }
      this.bleDevice = null;
    }
    this.connectedDevice = null;
    this.updateStatus('disconnected');
  }

  destroy() {
    this.disconnect();
    this.callbacks = {};
  }
}

export const bleService = new BLEService();
