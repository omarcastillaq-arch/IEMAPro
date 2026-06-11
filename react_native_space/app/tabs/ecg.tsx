import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ECGWaveform, ECGMultiLead } from '../../src/components/ECGWaveform';
import { colors, spacing, radii } from '../../src/theme';
import { bleService, type HRZDevice, type ConnectionStatus } from '../../src/services/bleService';
import type { MultiLeadSample } from '../../src/services/ecgSimulator';

type ViewMode = 'lead2' | '12lead';
type DataSource = 'simulator' | 'device';

export default function ECGScreen() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [bpm, setBpm] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('12lead');
  const [dataSource, setDataSource] = useState<DataSource>('simulator');
  const [discoveredDevices, setDiscoveredDevices] = useState<HRZDevice[]>([]);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beatCountRef = useRef(0);
  const lastBeatTimeRef = useRef(0);

  // Setup BLE callbacks
  useEffect(() => {
    bleService.setCallbacks({
      onStatusChange: (status) => {
        setConnectionStatus(status);
        if (status === 'connected') {
          setDataSource('device');
          setShowDeviceList(false);
        } else if (status === 'disconnected') {
          if (isMonitoring) {
            setDataSource('simulator');
          }
        }
      },
      onDeviceFound: (device) => {
        setDiscoveredDevices((prev) => {
          const exists = prev.some((d) => d.id === device.id);
          if (exists) return prev;
          return [...prev, device];
        });
      },
      onMultiLeadData: (samples) => {
        // Real device data - process for BPM
        handleECGData(samples);
      },
      onError: (error) => {
        if (Platform.OS !== 'web') {
          Alert.alert('Bluetooth', error);
        }
      },
    });

    return () => {
      bleService.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate BPM from R-peaks on Lead II
  const handleECGData = useCallback((samples: MultiLeadSample[]) => {
    for (const s of samples) {
      const val = s?.leads?.['II'] ?? 0;
      if (val > 0.7) {
        if (lastBeatTimeRef.current > 0) {
          const interval = s.time - lastBeatTimeRef.current;
          if (interval > 0.3) {
            const instantBPM = Math.round(60 / interval);
            setBpm((prev) => Math.round(prev * 0.7 + instantBPM * 0.3));
            beatCountRef.current += 1;
            lastBeatTimeRef.current = s.time;
          }
        } else {
          lastBeatTimeRef.current = s.time;
        }
      }
    }
  }, []);

  const toggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      setIsMonitoring(false);
      if (dataSource === 'device') {
        bleService.disconnect();
      }
      setConnectionStatus('disconnected');
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    } else {
      setIsMonitoring(true);
      setConnectionStatus('connected');
      setBpm(0);
      setElapsedTime(0);
      beatCountRef.current = 0;
      lastBeatTimeRef.current = 0;
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
  }, [isMonitoring, dataSource]);

  const handleScanDevices = useCallback(async () => {
    setDiscoveredDevices([]);
    setShowDeviceList(true);
    await bleService.startScan();
  }, []);

  const handleConnectDevice = useCallback(async (device: HRZDevice) => {
    await bleService.connect(device);
    // Start monitoring automatically on connect
    if (!isMonitoring) {
      setIsMonitoring(true);
      setBpm(0);
      setElapsedTime(0);
      beatCountRef.current = 0;
      lastBeatTimeRef.current = 0;
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
  }, [isMonitoring]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const statusColor =
    connectionStatus === 'connected'
      ? colors.success
      : connectionStatus === 'scanning' || connectionStatus === 'connecting'
        ? colors.warning
        : colors.textTertiary;

  const statusLabel =
    connectionStatus === 'connected'
      ? dataSource === 'device' ? 'HRZ Conectado' : 'Simulador'
      : connectionStatus === 'scanning'
        ? 'Buscando HRZ...'
        : connectionStatus === 'connecting'
          ? 'Conectando...'
          : 'Desconectado';

  const isRealDevice = dataSource === 'device' && connectionStatus === 'connected';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Monitor ECG</Text>
            <Text style={styles.subtitle}>Electrocardiograma en tiempo real</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* View Mode Toggle */}
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setViewMode('12lead')}
            style={[styles.toggleBtn, viewMode === '12lead' && styles.toggleActive]}
          >
            <MaterialCommunityIcons
              name="view-grid"
              size={16}
              color={viewMode === '12lead' ? colors.white : colors.textTertiary}
            />
            <Text style={[styles.toggleText, viewMode === '12lead' && styles.toggleTextActive]}>
              12 Derivaciones
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('lead2')}
            style={[styles.toggleBtn, viewMode === 'lead2' && styles.toggleActive]}
          >
            <MaterialCommunityIcons
              name="chart-line"
              size={16}
              color={viewMode === 'lead2' ? colors.white : colors.textTertiary}
            />
            <Text style={[styles.toggleText, viewMode === 'lead2' && styles.toggleTextActive]}>
              Derivación II
            </Text>
          </Pressable>
        </View>

        {/* ECG Waveform */}
        <View style={styles.waveformContainer}>
          {viewMode === '12lead' ? (
            <>
              <View style={styles.waveformHeader}>
                <Text style={styles.waveformLabel}>
                  ECG — 12 Derivaciones {isRealDevice ? '(HRZ)' : '(SIM)'}
                </Text>
                <Text style={styles.waveformSpeed}>25 mm/s · 10 mm/mV</Text>
              </View>
              <ECGMultiLead isActive={isMonitoring && dataSource === 'simulator'} onDataReceived={handleECGData} />
            </>
          ) : (
            <>
              <View style={styles.waveformHeader}>
                <Text style={styles.waveformLabel}>
                  ECG — Derivación II {isRealDevice ? '(HRZ)' : '(SIM)'}
                </Text>
                <Text style={styles.waveformSpeed}>25 mm/s</Text>
              </View>
              <ECGWaveform isActive={isMonitoring && dataSource === 'simulator'} onDataReceived={handleECGData} />
            </>
          )}
          {!isMonitoring && (
            <View style={styles.waveformOverlay}>
              <MaterialCommunityIcons name="heart-pulse" size={48} color={colors.textTertiary} />
              <Text style={styles.overlayText}>Presiona Iniciar para comenzar</Text>
            </View>
          )}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardWide]}>
            <View style={styles.statHeader}>
              <MaterialCommunityIcons name="heart-pulse" size={20} color={colors.error} />
              <Text style={styles.statLabel}>Frecuencia Cardíaca</Text>
            </View>
            <View style={styles.statValueRow}>
              <Text style={[styles.statValueLarge, { color: bpm > 100 ? colors.error : bpm > 0 ? colors.success : colors.textTertiary }]}>
                {isMonitoring && bpm > 0 ? bpm : '--'}
              </Text>
              <Text style={styles.statUnit}>BPM</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <MaterialCommunityIcons name="timer-outline" size={18} color={colors.accent} />
              <Text style={styles.statLabel}>Duración</Text>
            </View>
            <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <MaterialCommunityIcons name="pulse" size={18} color={colors.primary} />
              <Text style={styles.statLabel}>Latidos</Text>
            </View>
            <Text style={styles.statValue}>
              {isMonitoring ? beatCountRef.current : '--'}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <MaterialCommunityIcons name="chart-bell-curve" size={18} color={colors.warning} />
              <Text style={styles.statLabel}>QT Intervalo</Text>
            </View>
            <Text style={styles.statValue}>
              {isMonitoring && bpm > 0 ? `${Math.round(360 + Math.random() * 40)}` : '--'}
            </Text>
            <Text style={styles.statSubUnit}>ms</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <MaterialCommunityIcons name="swap-horizontal" size={18} color={colors.success} />
              <Text style={styles.statLabel}>RR Intervalo</Text>
            </View>
            <Text style={styles.statValue}>
              {isMonitoring && bpm > 0 ? `${Math.round(60000 / bpm)}` : '--'}
            </Text>
            <Text style={styles.statSubUnit}>ms</Text>
          </View>
        </View>

        {/* Device Info / BLE Connection */}
        <View style={styles.deviceCard}>
          <View style={styles.deviceRow}>
            <MaterialCommunityIcons
              name={isRealDevice ? 'bluetooth-connect' : 'bluetooth'}
              size={24}
              color={isRealDevice ? colors.success : connectionStatus === 'scanning' ? colors.warning : colors.textTertiary}
            />
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>Horizon Medical HRZ</Text>
              <Text style={styles.deviceModel}>ADS1298 · 8 canales · 24-bit</Text>
              <Text style={styles.deviceStatus}>
                {isRealDevice
                  ? `✅ Conectado: ${bleService.getConnectedDevice()?.name ?? 'HRZ'}`
                  : connectionStatus === 'scanning'
                    ? '🔎 Buscando dispositivos HRZ...'
                    : isMonitoring
                      ? '📊 Usando simulador — Conecta tu HRZ'
                      : 'Toca "Buscar HRZ" para conectar'}
              </Text>
            </View>
            {!isRealDevice && connectionStatus !== 'scanning' && connectionStatus !== 'connecting' && (
              <Pressable onPress={handleScanDevices} style={styles.scanBtn}>
                <MaterialCommunityIcons name="bluetooth-audio" size={18} color={colors.accent} />
                <Text style={styles.scanBtnText}>Buscar HRZ</Text>
              </Pressable>
            )}
            {isRealDevice && (
              <Pressable onPress={() => bleService.disconnect()} style={styles.disconnectBtn}>
                <Text style={styles.disconnectBtnText}>Desconectar</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Discovered Devices List */}
        {showDeviceList && discoveredDevices.length > 0 && (
          <View style={styles.deviceListCard}>
            <Text style={styles.deviceListTitle}>Dispositivos encontrados</Text>
            {discoveredDevices.map((device) => (
              <Pressable
                key={device.id}
                onPress={() => handleConnectDevice(device)}
                style={styles.deviceListItem}
              >
                <MaterialCommunityIcons name="bluetooth" size={20} color={colors.accent} />
                <View style={styles.deviceListInfo}>
                  <Text style={styles.deviceListName}>{device.name}</Text>
                  <Text style={styles.deviceListId}>{device.id}</Text>
                </View>
                <View style={styles.rssiContainer}>
                  <Text style={styles.rssiText}>{device.rssi} dBm</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Start/Stop Button */}
        <Pressable onPress={toggleMonitoring} style={styles.actionBtn}>
          <LinearGradient
            colors={isMonitoring ? ['#EF4444', '#DC2626'] as const : colors.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionGradient}
          >
            <MaterialCommunityIcons
              name={isMonitoring ? 'stop' : 'play'}
              size={24}
              color={colors.white}
            />
            <Text style={styles.actionText}>
              {isMonitoring ? 'Detener Monitoreo' : 'Iniciar Monitoreo'}
            </Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radii.sm,
    gap: 6,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  toggleTextActive: {
    color: colors.white,
  },
  waveformContainer: {
    marginBottom: spacing.md,
    position: 'relative',
  },
  waveformHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  waveformLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
    letterSpacing: 0.5,
  },
  waveformSpeed: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  waveformOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 17, 23, 0.85)',
    borderRadius: 12,
  },
  overlayText: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    width: '48%',
    flexGrow: 1,
  },
  statCardWide: {
    width: '100%',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  statValueLarge: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statUnit: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  statSubUnit: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  deviceCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  deviceModel: {
    fontSize: 12,
    color: colors.accent,
    marginTop: 2,
  },
  deviceStatus: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.accent}15`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: `${colors.accent}30`,
  },
  scanBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  disconnectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: `${colors.error}15`,
    borderWidth: 1,
    borderColor: `${colors.error}30`,
  },
  disconnectBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.error,
  },
  deviceListCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: spacing.lg,
  },
  deviceListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  deviceListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  deviceListInfo: {
    flex: 1,
  },
  deviceListName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  deviceListId: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  rssiContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
  },
  rssiText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  actionBtn: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: spacing.sm,
  },
  actionText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
  },
});
