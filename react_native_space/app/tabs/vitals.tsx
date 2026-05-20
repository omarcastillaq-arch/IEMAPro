import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { patientApi, vitalsApi } from '../../src/api/services';
import { colors, spacing, radii } from '../../src/theme';
import { VitalRow } from '../../src/components/VitalRow';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import type { VitalReading } from '../../src/types';

const FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'BLOOD_PRESSURE', label: 'Presi\u00f3n Arterial' },
  { key: 'HEART_RATE', label: 'Frecuencia Card\u00edaca' },
  { key: 'GLUCOSE', label: 'Glucosa' },
];

const PAGE_SIZE = 20;

export default function VitalsHistoryScreen() {
  const [filter, setFilter] = useState('');
  const [items, setItems] = useState<VitalReading[]>([]);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const initialLoadDone = useRef(false);

  const fetchEnrollmentId = useCallback(async () => {
    try {
      const res = await patientApi.getDashboard();
      const eid = res?.data?.enrollment?.id ?? null;
      setEnrollmentId(eid);
      return eid;
    } catch {
      return null;
    }
  }, []);

  const fetchVitals = useCallback(async (eid: string, pageNum: number, typeFilter: string, append: boolean) => {
    try {
      const params: { type?: string; page: number; limit: number } = { page: pageNum, limit: PAGE_SIZE };
      if (typeFilter) params.type = typeFilter;
      const res = await vitalsApi.getByEnrollment(eid, params);
      const newItems = res?.data?.items ?? [];
      setTotalPages(res?.data?.totalPages ?? 1);
      if (append) {
        setItems(prev => [...(prev ?? []), ...newItems]);
      } else {
        setItems(newItems);
      }
    } catch {
      if (!append) setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setLoading(true);
        let eid = enrollmentId;
        if (!eid) eid = await fetchEnrollmentId();
        if (eid) {
          setPage(1);
          await fetchVitals(eid, 1, filter, false);
        }
        setLoading(false);
        initialLoadDone.current = true;
      };
      load();
    }, [filter, enrollmentId, fetchEnrollmentId, fetchVitals])
  );

  const onRefresh = async () => {
    if (!enrollmentId) return;
    setRefreshing(true);
    setPage(1);
    await fetchVitals(enrollmentId, 1, filter, false);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || page >= totalPages || !enrollmentId) return;
    setLoadingMore(true);
    const next = page + 1;
    await fetchVitals(enrollmentId, next, filter, true);
    setPage(next);
    setLoadingMore(false);
  };

  const onFilterChange = (key: string) => {
    setFilter(key);
    setPage(1);
    setItems([]);
  };

  if (loading && !initialLoadDone.current) return <LoadingScreen message="Cargando historial..." />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>Mis Signos Vitales</Text>

      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={i => i.key}
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={styles.filterContent}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, filter === item.key && styles.chipActive]}
            onPress={() => onFilterChange(item.key)}
          >
            <Text style={[styles.chipText, filter === item.key && styles.chipTextActive]}>{item.label}</Text>
          </Pressable>
        )}
      />

      <FlatList
        data={items ?? []}
        keyExtractor={(item, idx) => item?.id ?? String(idx)}
        renderItem={({ item }) => <VitalRow vital={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<EmptyState message="No hay registros" icon="clipboard-text-outline" />}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ padding: 16 }} /> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: spacing.md, paddingTop: spacing.md, marginBottom: spacing.sm },
  filterList: { maxHeight: 48, marginBottom: spacing.sm },
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
