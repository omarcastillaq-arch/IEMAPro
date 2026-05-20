import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Chip } from 'react-native-paper';
import { useAuth } from '../../src/context/AuthContext';
import { patientApi } from '../../src/api/services';
import { colors, spacing, radii } from '../../src/theme';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { formatDate, getInitials } from '../../src/utils/format';
import type { PatientProfile } from '../../src/types';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await patientApi.getProfile();
      setProfile(res?.data ?? null);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchProfile();
    }, [fetchProfile])
  );

  if (loading && !refreshing) return <LoadingScreen message="Cargando perfil..." />;

  const name = profile?.name ?? user?.name ?? 'Paciente';
  const genderLabel = (g: string | null | undefined) => {
    if (g === 'M') return 'Masculino';
    if (g === 'F') return 'Femenino';
    if (g) return g;
    return '\u2014';
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} tintColor={colors.primary} />}
      >
        <Text style={styles.header}>Mi Perfil</Text>

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(name)}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{profile?.email ?? user?.email ?? ''}</Text>
        </View>

        {/* Personal Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informaci\u00f3n Personal</Text>
          <InfoRow label="Fecha de nacimiento" value={formatDate(profile?.date_of_birth)} />
          <InfoRow label="G\u00e9nero" value={genderLabel(profile?.gender)} />
          <InfoRow label="Tipo de sangre" value={profile?.blood_type ?? '\u2014'} />
          <InfoRow label="Altura" value={profile?.height_cm ? `${profile.height_cm} cm` : '\u2014'} />
          <InfoRow label="Peso" value={profile?.weight_kg ? `${profile.weight_kg} kg` : '\u2014'} />
        </View>

        {/* Medical Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informaci\u00f3n M\u00e9dica</Text>
          <ChipRow label="Alergias" items={profile?.allergies} />
          <ChipRow label="Medicamentos" items={profile?.medications} />
          <ChipRow label="Condiciones" items={profile?.conditions} />
        </View>

        {/* Emergency Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contacto de Emergencia</Text>
          <InfoRow label="Nombre" value={profile?.emergency_contact_name ?? '\u2014'} />
          <InfoRow label="Tel\u00e9fono" value={profile?.emergency_contact_phone ?? '\u2014'} />
        </View>

        {/* Insurance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seguro M\u00e9dico</Text>
          <InfoRow label="Proveedor" value={profile?.insurance_provider ?? '\u2014'} />
          <InfoRow label="N\u00famero" value={profile?.insurance_number ?? '\u2014'} />
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Cerrar Sesi\u00f3n</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const ChipRow: React.FC<{ label: string; items?: string[] }> = ({ label, items }) => (
  <View style={styles.chipRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <View style={styles.chipsWrap}>
      {(items?.length ?? 0) > 0 ? (
        (items ?? []).map((item, i) => (
          <Chip key={`${item}-${i}`} style={styles.chipItem} textStyle={styles.chipItemText}>{item}</Chip>
        ))
      ) : (
        <Text style={styles.infoValue}>\u2014</Text>
      )}
    </View>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.md },
  header: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, paddingTop: spacing.md, marginBottom: spacing.lg },
  avatarWrap: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary + '30',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.primary },
  name: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  email: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  section: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  infoLabel: { fontSize: 14, color: colors.textSecondary },
  infoValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  chipRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 6 },
  chipItem: { backgroundColor: colors.primary + '20' },
  chipItemText: { color: colors.primary, fontSize: 12 },
  logoutBtn: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  logoutText: { color: colors.error, fontSize: 16, fontWeight: '600' },
});
