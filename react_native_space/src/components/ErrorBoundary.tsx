import React, { Component, type ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.msg}>{this.state.error?.message ?? 'Error desconocido'}</Text>
          <Pressable style={styles.btn} onPress={() => this.setState({ hasError: false, error: null })}>
            <Text style={styles.btnText}>Reintentar</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: colors.error, marginBottom: 12 },
  msg: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: colors.white, fontWeight: '600', fontSize: 16 },
});
