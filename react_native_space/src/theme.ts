import { MD3DarkTheme } from 'react-native-paper';
import { Platform } from 'react-native';

export const colors = {
  background: '#0A0A0A',
  surface: '#111111',
  card: '#161616',
  cardBorder: 'rgba(255,255,255,0.03)',
  primary: '#4F46E5',
  accent: '#06B6D4',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  white: '#FFFFFF',
  inputBg: '#1A1A1A',
  gradientPrimary: ['#4F46E5', '#06B6D4'] as const,
} as const;

export const fonts = {
  heading: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'Arial, sans-serif',
  }) as string,
  body: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'Arial, sans-serif',
  }) as string,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const paperTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
    secondary: colors.accent,
    background: colors.background,
    surface: colors.surface,
    error: colors.error,
    onPrimary: colors.white,
    onSurface: colors.textPrimary,
    onBackground: colors.textPrimary,
    surfaceVariant: colors.card,
    outline: colors.cardBorder,
  },
};
