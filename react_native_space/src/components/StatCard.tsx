import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, radii } from '../theme';

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  iconColor?: string;
  isAbnormal?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const StatCard: React.FC<Props> = ({ title, value, subtitle, icon, iconColor, isAbnormal, style }) => (
  <View style={[styles.card, isAbnormal && styles.abnormal, style]}>
    <View style={[styles.iconWrap, { backgroundColor: (iconColor ?? colors.primary) + '20' }]}>
      <MaterialCommunityIcons name={icon as never} size={24} color={iconColor ?? colors.primary} />
    </View>
    <Text style={styles.title} numberOfLines={1}>{title}</Text>
    <Text style={[styles.value, isAbnormal && { color: colors.error }]} numberOfLines={1}>{value}</Text>
    {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minWidth: 140,
    marginRight: spacing.sm,
  },
  abnormal: { borderColor: colors.error + '40' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  value: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  subtitle: { fontSize: 11, color: colors.textTertiary },
});
