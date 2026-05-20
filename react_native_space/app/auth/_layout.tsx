import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { colors } from '../../src/theme';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Redirect href="/tabs" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade',
      }}
    />
  );
}
