import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, radii } from '../theme';
import { formatVitalValue, vitalTypeLabel, vitalTypeIcon, vitalTypeColor, formatDateTime } from '../utils/format';
import type { VitalReading } from '../types';

interface Props {
  vital: VitalReading;
  showPatientName?: boolean;
}

export const VitalRow: React.FC<Props> = ({ vital, showPatientName }) => {
  const iconName = vitalTypeIcon(vital?.vital_type ?? '');
  const iconColor = vitalTypeColor(vital?.vital_type ?? '');

  return (
    <View style={[styles.row, vital?.is_abnormal && styles.abnormalRow]}>
      <View style={[styles.iconWrap, { backgroundColor: iconColor + '20' }]}>
        <MaterialCommunityIcons name={iconName as never} size={20} color={iconColor} />
      </View>
      <View style={styles.content}>
        {showPatientName && vital?.patient_name ? <Text style={styles.patientName}>{vital.patient_name}</Text> : null}
        <Text style={styles.typeLabel}>{vitalTypeLabel(vital?.vital_type ?? '')}</Text>
        <Text style={[styles.value, vital?.is_abnormal && { color: colors.error }]}>
          {formatVitalValue(vital?.vital_type ?? '', vital?.value ?? 0, vital?.value2)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.date}>{formatDateTime(vital?.recorded_at)}</Text>
        {vital?.is_abnormal ? (
          <View style={styles.abnBadge}>
            <Text style={styles.abnText}>⚠</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  abnormalRow: { borderColor: colors.error + '30' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  content: { flex: 1 },
  patientName: { fontSize: 12, color: colors.accent, fontWeight: '600', marginBottom: 2 },
  typeLabel: { fontSize: 12, color: colors.textTertiary, marginBottom: 2 },
  value: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  right: { alignItems: 'flex-end' },
  date: { fontSize: 11, color: colors.textTertiary },
  abnBadge: {
    marginTop: 4,
    backgroundColor: colors.error + '20',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  abnText: { fontSize: 12, color: colors.error },
});
