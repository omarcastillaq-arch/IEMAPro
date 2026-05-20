import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { doctorApi, vitalsApi, alertsApi } from '../../../src/api/services';
import { colors, spacing, radii } from '../../../src/theme';
import { VitalRow } from '../../../src/components/VitalRow';
import { AlertCard } from '../../../src/components/AlertCard';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { EmptyState } from '../../../src/components/EmptyState';
import { formatDate, statusLabel, vitalTypeLabel, formatVitalValue } from '../../../src/utils/format';
import type { Enrollment, VitalReading, AlertItem } from '../../../src/types';

type Tab = 'vitals' | 'charts' | 'alerts';
type ChartType = 'BLOOD_PRESSURE' | 'HEART_RATE' | 'GLUCOSE';

const screenWidth = Dimensions.get('window').width - 32;

export default function PatientDetailScreen() {
  const { enrollmentId = '' } = useLocalSearchParams<{ enrollmentId: string }>();
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('vitals');
  const [chartType, setChartType] = useState<ChartType>('HEART_RATE');

  const fetchData = useCallback(async () => {
    if (!enrollmentId) return;
    try {
      const [detailRes, vitalsRes, alertsRes] = await Promise.all([
        doctorApi.getPatientDetail(enrollmentId),
        vitalsApi.getByEnrollment(enrollmentId, { limit: 20 }),
        alertsApi.getByEnrollment(enrollmentId),
      ]);
      setEnrollment(detailRes?.data?.enrollment ?? null);
      setVitals(vitalsRes?.data?.items ?? []);
      setAlerts(alertsRes?.data?.items ?? []);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, [enrollmentId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData])
  );

  const onAcknowledge = async (alertId: string) => {
    try {
      await alertsApi.acknowledge(alertId);
      setAlerts(prev => (prev ?? []).map(a => a?.id === alertId ? { ...a, status: 'ACKNOWLEDGED' } : a));
    } catch { /* ignore */ }
  };

  const chartData = useMemo(() => {
    const filtered = (vitals ?? []).filter(v => v?.vital_type === chartType).reverse().slice(-10);
    if (filtered.length === 0) return null;
    const labels = filtered.map(v => {
      try {
        const d = new Date(v?.recorded_at ?? '');
        return `${d.getDate()}/${d.getMonth() + 1}`;
      } catch { return ''; }
    });
    const datasets: { data: number[]; color?: (opacity: number) => string; strokeWidth?: number }[] = [
      { data: filtered.map(v => v?.value ?? 0), color: () => colors.primary, strokeWidth: 2 },
    ];
    if (chartType === 'BLOOD_PRESSURE') {
      datasets.push({ data: filtered.map(v => v?.value2 ?? 0), color: () => colors.accent, strokeWidth: 2 });
    }
    return { labels, datasets };
  }, [vitals, chartType]);

  if (loading && !refreshing) return <LoadingScreen message="Cargando detalle..." />;
  if (!enrollmentId) return <EmptyState message="ID de inscripci\u00f3n no proporcionado" />;

  const isActive = enrollment?.status === 'active';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/tabs')} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{enrollment?.patient_name ?? 'Paciente'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />}
      >
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoName}>{enrollment?.patient_name ?? 'Paciente'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: isActive ? colors.success + '20' : colors.warning + '20' }]}>
              <Text style={[styles.statusText, { color: isActive ? colors.success : colors.warning }]}>{statusLabel(enrollment?.status ?? '')}</Text>
            </View>
          </View>
          <Text style={styles.infoDetail}>Diagn\u00f3stico: {enrollment?.diagnosis ?? 'Sin diagn\u00f3stico'}</Text>
          <Text style={styles.infoDetail}>Inscrito: {formatDate(enrollment?.enrolled_at)}</Text>
          <Text style={styles.infoDetail}>Monitoreo: {enrollment?.monitoring_type ?? '\u2014'}</Text>
        </View>

        {/* Tabs */}
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          buttons={[
            { value: 'vitals', label: 'Signos', icon: 'pulse' },
            { value: 'charts', label: 'Gr\u00e1ficas', icon: 'chart-line' },
            { value: 'alerts', label: 'Alertas', icon: 'bell' },
          ]}
          style={styles.segments}
          theme={{ colors: { secondaryContainer: colors.primary + '30', onSecondaryContainer: colors.primary } }}
        />

        {/* Vitals Tab */}
        {tab === 'vitals' && (
          <View>
            {(vitals?.length ?? 0) > 0 ? (
              (vitals ?? []).slice(0, 10).map(v => <VitalRow key={v?.id} vital={v} />)
            ) : (
              <EmptyState message="No hay signos vitales" icon="clipboard-pulse" />
            )}
          </View>
        )}

        {/* Charts Tab */}
        {tab === 'charts' && (
          <View>
            {/* Chart type selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartFilters}>
              {(['BLOOD_PRESSURE', 'HEART_RATE', 'GLUCOSE'] as ChartType[]).map(t => (
                <Pressable
                  key={t}
                  style={[styles.chip, chartType === t && styles.chipActive]}
                  onPress={() => setChartType(t)}
                >
                  <Text style={[styles.chipText, chartType === t && styles.chipTextActive]}>{vitalTypeLabel(t)}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {chartData ? (
              <View style={styles.chartWrap}>
                <LineChart
                  data={{
                    labels: chartData.labels,
                    datasets: chartData.datasets,
                  }}
                  width={screenWidth}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: colors.card,
                    backgroundGradientFrom: colors.card,
                    backgroundGradientTo: colors.card,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
                    labelColor: () => colors.textTertiary,
                    propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary },
                    propsForBackgroundLines: { stroke: colors.cardBorder },
                  }}
                  bezier
                  style={styles.chart}
                />
                {chartType === 'BLOOD_PRESSURE' ? (
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                      <Text style={styles.legendText}>Sist\u00f3lica</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                      <Text style={styles.legendText}>Diast\u00f3lica</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : (
              <EmptyState message="Sin datos para gr\u00e1fica" icon="chart-line" />
            )}
          </View>
        )}

        {/* Alerts Tab */}
        {tab === 'alerts' && (
          <View>
            {(alerts?.length ?? 0) > 0 ? (
              (alerts ?? []).map(a => (
                <AlertCard key={a?.id} alert={a} onAcknowledge={a?.status === 'NEW' ? onAcknowledge : undefined} />
              ))
            ) : (
              <EmptyState message="Sin alertas activas \u2713" icon="bell-check" />
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, flex: 1, textAlign: 'center' },
  scrollContent: { paddingHorizontal: spacing.md },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  infoName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  infoDetail: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  segments: { marginBottom: spacing.md },
  chartFilters: { marginBottom: spacing.md },
  chip: {
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  chartWrap: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chart: { borderRadius: radii.md },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textSecondary },
});
