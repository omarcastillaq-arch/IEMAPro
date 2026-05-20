import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { colors } from '../theme';

export const LoadingScreen: React.FC<{ message?: string }> = ({ message }) => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color={colors.primary} />
    {message ? <Text style={styles.text}>{message}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  text: { marginTop: 16, color: colors.textSecondary, fontSize: 14 },
});
