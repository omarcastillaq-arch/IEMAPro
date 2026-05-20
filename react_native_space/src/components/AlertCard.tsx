import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, radii } from '../theme';
import { priorityLabel, formatDateTime } from '../utils/format';
import type { AlertItem } from '../types';

interface Props {
  alert: AlertItem;
  onAcknowledge?: (id: string) => void;
  onPress?: () => void;
  showPatient?: boolean;
}

export const AlertCard: React.FC<Props> = ({ alert, onAcknowledge, onPress, showPatient }) => {
  const isC = alert?.priority === 'CRITICAL';
  const bgColor = isC ? colors.error + '15' : colors.warning + '15';
  const badgeColor = isC ? colors.error : colors.warning;

  return (
    <Pressable
      style={[styles.card, { backgroundColor: bgColor }]}
      onPress={onPress}
      accessibilityLabel={`Alerta ${isC ? 'crítica' : 'de advertencia'}: ${alert?.message ?? ''}`}
    >
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{priorityLabel(alert?.priority ?? '')}</Text>
        </View>
        {alert?.status === 'NEW' && (
          <View style={[styles.statusBadge, { backgroundColor: colors.primary + '30' }]}>
            <Text style={[styles.statusText, { color: colors.accent }]}>NUEVA</Text>
          </View>
        )}
        {alert?.status === 'ACKNOWLEDGED' && (
          <View style={[styles.statusBadge, { backgroundColor: colors.textTertiary + '20' }]}>
            <Text style={[styles.statusText, { color: colors.textTertiary }]}>RECONOCIDA</Text>
          </View>
        )}
      </View>
      {showPatient && alert?.patient_name ? <Text style={styles.patient}>{alert.patient_name}</Text> : null}
      <Text style={styles.message} numberOfLines={2}>{alert?.message ?? ''}</Text>
      <View style={styles.footer}>
        <Text style={styles.date}>{formatDateTime(alert?.created_at)}</Text>
        {alert?.status === 'NEW' && onAcknowledge ? (
          <Pressable
            onPress={() => onAcknowledge(alert.id)}
            style={styles.ackBtn}
            accessibilityLabel="Reconocer alerta"
          >
            <Text style={styles.ackText}>Reconocer</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: { fontSize: 9, fontWeight: '700' },
  patient: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  message: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 8 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 12, color: colors.textTertiary },
  ackBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ackText: { color: colors.white, fontSize: 13, fontWeight: '600' },
});
