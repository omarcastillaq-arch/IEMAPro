import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

interface Props {
  icon?: string;
  message: string;
  submessage?: string;
}

export const EmptyState: React.FC<Props> = ({ icon, message, submessage }) => (
  <View style={styles.container}>
    {icon ? <MaterialCommunityIcons name={icon as never} size={48} color={colors.textTertiary} /> : null}
    <Text style={styles.msg}>{message}</Text>
    {submessage ? <Text style={styles.sub}>{submessage}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.xxl },
  msg: { fontSize: 16, color: colors.textSecondary, marginTop: 12, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.textTertiary, marginTop: 4, textAlign: 'center' },
});
