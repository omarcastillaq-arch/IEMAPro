import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doctorApi } from '../../src/api/services';
import { colors, spacing, radii } from '../../src/theme';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { EmptyState } from '../../src/components/EmptyState';
import { formatDate, statusLabel, getInitials } from '../../src/utils/format';
import type { DoctorPatient } from '../../src/types';

export default function PatientsListScreen() {
  const router = useRouter();
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchPatients = useCallback(async () => {
    try {
      const res = await doctorApi.getPatients();
      setPatients(res?.data?.patients ?? []);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchPatients();
    }, [fetchPatients])
  );

  const filtered = (patients ?? []).filter(p =>
    (p?.patient_name ?? '').toLowerCase().includes((search ?? '').toLowerCase())
  );

  if (loading && !refreshing) return <LoadingScreen message="Cargando pacientes..." />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>Mis Pacientes</Text>
      <View style={styles.searchWrap}>
        <Searchbar
          placeholder="Buscar paciente..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={colors.textTertiary}
          placeholderTextColor={colors.textTertiary}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item, idx) => item?.enrollment_id ?? String(idx)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPatients(); }} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyState message="No tiene pacientes asignados" icon="account-off" />}
        renderItem={({ item }) => {
          const isActive = item?.status === 'active';
          return (
            <Pressable
              style={styles.patientCard}
              onPress={() => router.push(`/patient-detail/${item?.enrollment_id ?? ''}`)}
            >
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarSmallText}>{getInitials(item?.patient_name)}</Text>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.nameRow}>
                  <Text style={styles.patientName}>{item?.patient_name ?? 'Paciente'}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: isActive ? colors.success + '20' : colors.warning + '20' }]}>
                    <Text style={[styles.statusText, { color: isActive ? colors.success : colors.warning }]}>
                      {statusLabel(item?.status ?? '')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.diagnosis}>{item?.diagnosis ?? 'Sin diagn\u00f3stico'}</Text>
                <Text style={styles.dateCaption}>
                  {item?.last_data_received_at ? `\u00daltimo dato: ${formatDate(item.last_data_received_at)}` : 'Sin datos recibidos'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textTertiary} />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: spacing.md, paddingTop: spacing.md, marginBottom: spacing.sm },
  searchWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchbar: { backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.cardBorder, elevation: 0 },
  searchInput: { color: colors.textPrimary, fontSize: 14 },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  avatarSmall: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary + '25',
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarSmallText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  cardContent: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  patientName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  diagnosis: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  dateCaption: { fontSize: 11, color: colors.textTertiary },
});
