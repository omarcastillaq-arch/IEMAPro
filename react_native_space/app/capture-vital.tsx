import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, KeyboardAvoidingView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, radii } from '../src/theme';
import { vitalsApi } from '../src/api/services';

type VitalType = 'BLOOD_PRESSURE' | 'HEART_RATE' | 'GLUCOSE';

const TYPES: { key: VitalType; label: string; icon: string; color: string }[] = [
  { key: 'BLOOD_PRESSURE', label: 'Presi\u00f3n Arterial', icon: 'heart-pulse', color: colors.error },
  { key: 'HEART_RATE', label: 'Frecuencia Card\u00edaca', icon: 'pulse', color: colors.primary },
  { key: 'GLUCOSE', label: 'Glucosa', icon: 'water', color: colors.warning },
];

export default function CaptureVitalScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<VitalType>('BLOOD_PRESSURE');
  const [value1, setValue1] = useState('');
  const [value2, setValue2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ isAbnormal: boolean; alerts: number } | null>(null);

  const validate = (): string | null => {
    const v1 = parseFloat(value1);
    if (isNaN(v1)) return 'Ingresa un valor v\u00e1lido';
    if (selectedType === 'BLOOD_PRESSURE') {
      const v2 = parseFloat(value2);
      if (isNaN(v2)) return 'Ingresa el valor diast\u00f3lico';
      if (v1 < 60 || v1 > 250) return 'Sist\u00f3lica debe estar entre 60 y 250';
      if (v2 < 30 || v2 > 150) return 'Diast\u00f3lica debe estar entre 30 y 150';
    }
    if (selectedType === 'HEART_RATE' && (v1 < 30 || v1 > 220)) return 'Frecuencia card\u00edaca entre 30 y 220';
    if (selectedType === 'GLUCOSE' && (v1 < 20 || v1 > 600)) return 'Glucosa entre 20 y 600';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    setSuccess(null);
    try {
      const body: { vital_type: string; value: number; value2?: number; recorded_at: string } = {
        vital_type: selectedType,
        value: parseFloat(value1),
        recorded_at: new Date().toISOString(),
      };
      if (selectedType === 'BLOOD_PRESSURE') body.value2 = parseFloat(value2);
      const res = await vitalsApi.create(body);
      const alertsCount = res?.data?.alerts?.length ?? 0;
      const isAbn = res?.data?.vital?.is_abnormal ?? false;
      setSuccess({ isAbnormal: isAbn, alerts: alertsCount });
      // Reset
      setValue1('');
      setValue2('');
      // Navigate back after brief delay
      setTimeout(() => {
        if (router.canGoBack()) router.back();
      }, 2000);
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  const selectedMeta = TYPES.find(t => t.key === selectedType);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/tabs')} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>Registrar Signo Vital</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Type Selector */}
          <View style={styles.typeRow}>
            {TYPES.map(t => (
              <Pressable
                key={t.key}
                style={[styles.typeCard, selectedType === t.key && { borderColor: t.color, backgroundColor: t.color + '15' }]}
                onPress={() => { setSelectedType(t.key); setError(''); setSuccess(null); }}
              >
                <MaterialCommunityIcons name={t.icon as never} size={28} color={selectedType === t.key ? t.color : colors.textTertiary} />
                <Text style={[styles.typeLabel, selectedType === t.key && { color: t.color }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Inputs */}
          <View style={styles.inputSection}>
            {selectedType === 'BLOOD_PRESSURE' ? (
              <View style={styles.bpRow}>
                <View style={styles.bpInput}>
                  <TextInput
                    label="Sist\u00f3lica"
                    value={value1}
                    onChangeText={setValue1}
                    keyboardType="numeric"
                    mode="outlined"
                    style={styles.input}
                    outlineColor={colors.cardBorder}
                    activeOutlineColor={selectedMeta?.color}
                    textColor={colors.textPrimary}
                    theme={{ colors: { onSurfaceVariant: colors.textTertiary } }}
                  />
                </View>
                <Text style={styles.slash}>/</Text>
                <View style={styles.bpInput}>
                  <TextInput
                    label="Diast\u00f3lica"
                    value={value2}
                    onChangeText={setValue2}
                    keyboardType="numeric"
                    mode="outlined"
                    style={styles.input}
                    outlineColor={colors.cardBorder}
                    activeOutlineColor={selectedMeta?.color}
                    textColor={colors.textPrimary}
                    theme={{ colors: { onSurfaceVariant: colors.textTertiary } }}
                  />
                </View>
                <Text style={styles.unitText}>mmHg</Text>
              </View>
            ) : (
              <View style={styles.singleRow}>
                <View style={styles.singleInput}>
                  <TextInput
                    label="Valor"
                    value={value1}
                    onChangeText={setValue1}
                    keyboardType="numeric"
                    mode="outlined"
                    style={styles.input}
                    outlineColor={colors.cardBorder}
                    activeOutlineColor={selectedMeta?.color}
                    textColor={colors.textPrimary}
                    theme={{ colors: { onSurfaceVariant: colors.textTertiary } }}
                  />
                </View>
                <Text style={styles.unitText}>
                  {selectedType === 'HEART_RATE' ? 'bpm' : 'mg/dL'}
                </Text>
              </View>
            )}
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Success */}
          {success ? (
            <View style={[styles.successWrap, success.isAbnormal && { backgroundColor: colors.warning + '15', borderColor: colors.warning + '30' }]}>
              <MaterialCommunityIcons
                name={success.isAbnormal ? 'alert' : 'check-circle'}
                size={24}
                color={success.isAbnormal ? colors.warning : colors.success}
              />
              <Text style={[styles.successText, success.isAbnormal && { color: colors.warning }]}>
                {success.isAbnormal
                  ? `\u26a0 Valor anormal detectado. ${success.alerts > 0 ? `Se gener${success.alerts === 1 ? '\u00f3' : 'aron'} ${success.alerts} alerta${success.alerts > 1 ? 's' : ''}.` : ''}`
                  : 'Signo vital registrado correctamente'}
              </Text>
            </View>
          ) : null}

          {/* Submit */}
          <Pressable onPress={handleSubmit} disabled={loading || !!success} style={styles.btnWrap}>
            <LinearGradient
              colors={colors.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.submitBtn, (loading || !!success) && { opacity: 0.6 }]}
            >
              <Text style={styles.submitText}>{loading ? 'Guardando...' : 'Guardar Registro'}</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  typeCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  typeLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  inputSection: { marginBottom: spacing.md },
  bpRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bpInput: { flex: 1 },
  slash: { fontSize: 28, color: colors.textTertiary, marginTop: 8 },
  singleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  singleInput: { flex: 1 },
  unitText: { fontSize: 16, color: colors.textSecondary, fontWeight: '600', marginTop: 8 },
  input: { backgroundColor: colors.inputBg },
  errorWrap: { backgroundColor: colors.error + '15', padding: spacing.sm, borderRadius: radii.sm, marginBottom: spacing.md },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center' },
  successWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  successText: { flex: 1, color: colors.success, fontSize: 14, fontWeight: '600' },
  btnWrap: { marginTop: spacing.sm },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  submitText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
