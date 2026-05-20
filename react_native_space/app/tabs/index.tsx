import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { patientApi, doctorApi } from '../../src/api/services';
import { colors, spacing, radii } from '../../src/theme';
import { StatCard } from '../../src/components/StatCard';
import { AlertCard } from '../../src/components/AlertCard';
import { VitalRow } from '../../src/components/VitalRow';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { EmptyState } from '../../src/components/EmptyState';
import { formatVitalValue, formatTimeAgo } from '../../src/utils/format';
import type { PatientDashboardData, DoctorDashboardData } from '../../src/types';

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const role = user?.role ?? 'PATIENT';

  if (role === 'DOCTOR') return <DoctorDashboard />;
  return <PatientDashboard />;
}

function PatientDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<PatientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const res = await patientApi.getDashboard();
      setData(res?.data ?? null);
    } catch (_e) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading && !refreshing) return <LoadingScreen message="Cargando dashboard..." />;

  const lv = data?.lastVitals;
  const firstName = user?.name?.split(' ')?.[0] ?? 'Paciente';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.greeting}>¡Hola, {firstName}!</Text>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Stat Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsRow}>
          <StatCard
            title="Presi\u00f3n Arterial"
            value={lv?.BLOOD_PRESSURE ? formatVitalValue('BLOOD_PRESSURE', lv.BLOOD_PRESSURE.value, lv.BLOOD_PRESSURE.value2) : 'Sin datos'}
            subtitle={lv?.BLOOD_PRESSURE ? formatTimeAgo(lv.BLOOD_PRESSURE.recorded_at) : ''}
            icon="heart-pulse"
            iconColor={colors.error}
            isAbnormal={lv?.BLOOD_PRESSURE?.is_abnormal}
          />
          <StatCard
            title="Frecuencia Card\u00edaca"
            value={lv?.HEART_RATE ? formatVitalValue('HEART_RATE', lv.HEART_RATE.value) : 'Sin datos'}
            subtitle={lv?.HEART_RATE ? formatTimeAgo(lv.HEART_RATE.recorded_at) : ''}
            icon="pulse"
            iconColor={colors.primary}
            isAbnormal={lv?.HEART_RATE?.is_abnormal}
          />
          <StatCard
            title="Glucosa"
            value={lv?.GLUCOSE ? formatVitalValue('GLUCOSE', lv.GLUCOSE.value) : 'Sin datos'}
            subtitle={lv?.GLUCOSE ? formatTimeAgo(lv.GLUCOSE.recorded_at) : ''}
            icon="water"
            iconColor={colors.warning}
            isAbnormal={lv?.GLUCOSE?.is_abnormal}
          />
        </ScrollView>

        {/* Recent Alerts */}
        <Text style={styles.sectionTitle}>Alertas Recientes</Text>
        {(data?.recentAlerts?.length ?? 0) > 0 ? (
          (data?.recentAlerts ?? []).map((a) => (
            <AlertCard key={a?.id ?? Math.random().toString()} alert={a} />
          ))
        ) : (
          <View style={styles.noAlerts}>
            <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} />
            <Text style={styles.noAlertsText}>Sin alertas recientes \u2713</Text>
          </View>
        )}

        {/* Recent Vitals */}
        <Text style={styles.sectionTitle}>\u00daltimos Registros</Text>
        {(data?.recentVitals?.length ?? 0) > 0 ? (
          (data?.recentVitals ?? []).map((v) => (
            <VitalRow key={v?.id ?? Math.random().toString()} vital={v} />
          ))
        ) : (
          <EmptyState message="No hay registros a\u00fan" icon="clipboard-pulse" />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/capture-vital')}
        accessibilityLabel="Registrar signo vital"
      >
        <MaterialCommunityIcons name="plus" size={28} color={colors.white} />
      </Pressable>
    </SafeAreaView>
  );
}

function DoctorDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DoctorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const res = await doctorApi.getDashboard();
      setData(res?.data ?? null);
    } catch (_e) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading && !refreshing) return <LoadingScreen message="Cargando dashboard..." />;

  const stats = data?.stats;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>{user?.name ?? 'Doctor'}</Text>
            <Text style={styles.dateText}>Panel de Control</Text>
          </View>
          <Pressable onPress={logout} style={styles.logoutIcon} accessibilityLabel="Cerrar sesi\u00f3n">
            <MaterialCommunityIcons name="logout" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsRow}>
          <StatCard
            title="Pacientes Activos"
            value={String(stats?.activePatients ?? 0)}
            icon="account-group"
            iconColor={colors.primary}
          />
          <StatCard
            title="Alertas Cr\u00edticas"
            value={String(stats?.criticalAlerts ?? 0)}
            icon="alert-circle"
            iconColor={colors.error}
            isAbnormal={(stats?.criticalAlerts ?? 0) > 0}
          />
          <StatCard
            title="Alertas Pendientes"
            value={String(stats?.pendingAlerts ?? 0)}
            icon="bell-alert"
            iconColor={colors.warning}
          />
        </ScrollView>

        <Text style={styles.sectionTitle}>Actividad Reciente</Text>
        {(data?.recentVitals?.length ?? 0) > 0 ? (
          (data?.recentVitals ?? []).map((v) => (
            <Pressable
              key={v?.id ?? Math.random().toString()}
              onPress={() => v?.enrollment_id ? router.push(`/patient-detail/${v.enrollment_id}`) : null}
            >
              <VitalRow vital={v} showPatientName />
            </Pressable>
          ))
        ) : (
          <EmptyState message="Sin actividad reciente" icon="clipboard-text" />
        )}

        <Text style={styles.sectionTitle}>Alertas Recientes</Text>
        {(data?.recentAlerts?.length ?? 0) > 0 ? (
          (data?.recentAlerts ?? []).map((a) => (
            <AlertCard
              key={a?.id ?? Math.random().toString()}
              alert={a}
              showPatient
              onPress={() => a?.enrollment_id ? router.push(`/patient-detail/${a.enrollment_id}`) : null}
            />
          ))
        ) : (
          <View style={styles.noAlerts}>
            <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} />
            <Text style={styles.noAlertsText}>Sin alertas \u2713</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  dateText: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  cardsRow: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  noAlerts: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    gap: 8,
  },
  noAlertsText: { color: colors.success, fontSize: 14, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  logoutIcon: { padding: 8 },
  errorText: { color: colors.error, fontSize: 14, marginBottom: spacing.md, textAlign: 'center' },
});
