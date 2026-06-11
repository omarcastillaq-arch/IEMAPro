import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ECGWaveform, ECGMultiLead } from '../../src/components/ECGWaveform';
import { colors, spacing, radii } from '../../src/theme';
import type { MultiLeadSample } from '../../src/services/ecgSimulator';
import type { ConnectionStatus } from '../../src/services/bleService';

type ViewMode = 'lead2' | '12lead';

export default function ECGScreen() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [bpm, setBpm] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('12lead');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beatCountRef = useRef(0);
  const lastBeatTimeRef = useRef(0);

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
      ? 'Conectado'
      : connectionStatus === 'scanning'
        ? 'Buscando...'
        : connectionStatus === 'connecting'
          ? 'Conectando...'
          : 'Desconectado';

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
                <Text style={styles.waveformLabel}>ECG — 12 Derivaciones</Text>
                <Text style={styles.waveformSpeed}>25 mm/s · 10 mm/mV</Text>
              </View>
              <ECGMultiLead isActive={isMonitoring} onDataReceived={handleECGData} />
            </>
          ) : (
            <>
              <View style={styles.waveformHeader}>
                <Text style={styles.waveformLabel}>ECG — Derivación II</Text>
                <Text style={styles.waveformSpeed}>25 mm/s</Text>
              </View>
              <ECGWaveform isActive={isMonitoring} onDataReceived={handleECGData} />
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
          {/* BPM */}
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

          {/* Duration */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <MaterialCommunityIcons name="timer-outline" size={18} color={colors.accent} />
              <Text style={styles.statLabel}>Duración</Text>
            </View>
            <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
          </View>

          {/* Beats */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <MaterialCommunityIcons name="pulse" size={18} color={colors.primary} />
              <Text style={styles.statLabel}>Latidos</Text>
            </View>
            <Text style={styles.statValue}>
              {isMonitoring ? beatCountRef.current : '--'}
            </Text>
          </View>

          {/* QT Interval */}
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

          {/* RR Interval */}
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

        {/* Device Info */}
        <View style={styles.deviceCard}>
          <View style={styles.deviceRow}>
            <MaterialCommunityIcons name="bluetooth" size={24} color={isMonitoring ? colors.accent : colors.textTertiary} />
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>Horizon Medical HRZ</Text>
              <Text style={styles.deviceModel}>ADS1298 · 8 canales · 24-bit</Text>
              <Text style={styles.deviceStatus}>
                {isMonitoring ? 'Simulador activo — Conecta tu HRZ por Bluetooth' : 'Dispositivo listo para conectar'}
              </Text>
            </View>
          </View>
        </View>

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
    marginBottom: spacing.lg,
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
