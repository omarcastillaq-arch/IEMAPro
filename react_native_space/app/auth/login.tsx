import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing, radii } from '../../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email?.trim() || !password?.trim()) {
      setError('Por favor ingresa tu correo y contrase\u00f1a');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Credenciales inv\u00e1lidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <Text style={styles.logoText}>HORIZON</Text>
            <Text style={styles.logoSub}>RPM</Text>
          </View>
          <Text style={styles.subtitle}>Monitoreo Remoto de Pacientes</Text>

          <View style={styles.formCard}>
            <TextInput
              label="Correo electr\u00f3nico"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              mode="outlined"
              style={styles.input}
              outlineColor={colors.cardBorder}
              activeOutlineColor={colors.primary}
              textColor={colors.textPrimary}
              theme={{ colors: { onSurfaceVariant: colors.textTertiary } }}
              accessibilityLabel="Correo electr\u00f3nico"
            />
            <TextInput
              label="Contrase\u00f1a"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              mode="outlined"
              style={styles.input}
              outlineColor={colors.cardBorder}
              activeOutlineColor={colors.primary}
              textColor={colors.textPrimary}
              theme={{ colors: { onSurfaceVariant: colors.textTertiary } }}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(p => !p)}
                  color={colors.textTertiary}
                />
              }
              accessibilityLabel="Contrase\u00f1a"
            />

            {error ? (
              <View style={styles.errorWrap}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable onPress={handleLogin} disabled={loading} style={styles.btnWrap}>
              <LinearGradient
                colors={colors.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.btn, loading && { opacity: 0.7 }]}
              >
                <Text style={styles.btnText}>{loading ? 'Iniciando...' : 'Iniciar Sesi\u00f3n'}</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <Text style={styles.version}>v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  logoWrap: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 4 },
  logoText: { fontSize: 36, fontWeight: '800', color: colors.primary, letterSpacing: 2 },
  logoSub: { fontSize: 20, fontWeight: '600', color: colors.accent, marginLeft: 8 },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  input: { marginBottom: spacing.md, backgroundColor: colors.inputBg },
  errorWrap: { backgroundColor: colors.error + '15', padding: spacing.sm, borderRadius: radii.sm, marginBottom: spacing.md },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center' },
  btnWrap: { marginTop: spacing.sm },
  btn: {
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', color: colors.textTertiary, fontSize: 12, marginTop: spacing.xl },
});
