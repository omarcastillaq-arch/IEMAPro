import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { doctorApi, alertsApi } from '../../src/api/services';
import { colors, spacing, radii } from '../../src/theme';
import { AlertCard } from '../../src/components/AlertCard';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { EmptyState } from '../../src/components/EmptyState';
import type { AlertItem } from '../../src/types';

const PRIORITY_FILTERS = [
  { key: '', label: 'Todas' },
  { key: 'CRITICAL', label: 'Cr\u00edticas' },
  { key: 'WARNING', label: 'Advertencia' },
];

const STATUS_FILTERS = [
  { key: 'NEW', label: 'Nuevas' },
  { key: 'ACKNOWLEDGED', label: 'Reconocidas' },
];

export default function AlertsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('NEW');

  const fetchAlerts = useCallback(async (pf: string, sf: string) => {
    try {
      const params: { priority?: string; status?: string } = {};
      if (pf) params.priority = pf;
      if (sf) params.status = sf;
      const res = await doctorApi.getAlerts(params);
      setItems(res?.data?.items ?? []);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchAlerts(priorityFilter, statusFilter);
    }, [fetchAlerts, priorityFilter, statusFilter])
  );

  const onAcknowledge = async (alertId: string) => {
    try {
      await alertsApi.acknowledge(alertId);
      setItems(prev => (prev ?? []).map(a => a?.id === alertId ? { ...a, status: 'ACKNOWLEDGED' } : a));
    } catch { /* ignore */ }
  };

  if (loading && !refreshing) return <LoadingScreen message="Cargando alertas..." />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>Alertas</Text>

      {/* Priority filter */}
      <FlatList
        horizontal
        data={PRIORITY_FILTERS}
        keyExtractor={i => `p-${i.key}`}
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={styles.filterContent}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, priorityFilter === item.key && styles.chipActive]}
            onPress={() => setPriorityFilter(item.key)}
          >
            <Text style={[styles.chipText, priorityFilter === item.key && styles.chipTextActive]}>{item.label}</Text>
          </Pressable>
        )}
      />

      {/* Status filter */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={i => `s-${i.key}`}
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={styles.filterContent}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, statusFilter === item.key && styles.chipActive]}
            onPress={() => setStatusFilter(item.key)}
          >
            <Text style={[styles.chipText, statusFilter === item.key && styles.chipTextActive]}>{item.label}</Text>
          </Pressable>
        )}
      />

      <FlatList
        data={items ?? []}
        keyExtractor={(item, idx) => item?.id ?? String(idx)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAlerts(priorityFilter, statusFilter); }} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyState message="No hay alertas pendientes \u2713" icon="bell-check" />}
        renderItem={({ item }) => (
          <AlertCard
            alert={item}
            showPatient
            onAcknowledge={item?.status === 'NEW' ? onAcknowledge : undefined}
            onPress={() => item?.enrollment_id ? router.push(`/patient-detail/${item.enrollment_id}`) : null}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: spacing.md, paddingTop: spacing.md, marginBottom: spacing.sm },
  filterList: { maxHeight: 44, marginBottom: 4 },
  filterContent: { paddingHorizontal: spacing.md, gap: 8 },
  chip: {
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: 40 },
});
