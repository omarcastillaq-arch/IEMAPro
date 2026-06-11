import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const insets = useSafeAreaInsets();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect href="/auth/login" />;

  const role = user?.role ?? 'PATIENT';
  const isDoctor = role === 'DOCTOR';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.cardBorder,
          borderTopWidth: 1,
          paddingBottom: insets.bottom,
          height: 60 + insets.bottom,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home" size={size} color={color} />,
          tabBarButtonTestID: 'tab-home',
        }}
      />
      <Tabs.Screen
        name="vitals"
        options={{
          title: 'Signos',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="pulse" size={size} color={color} />,
          href: isDoctor ? null : undefined,
          tabBarButtonTestID: 'tab-vitals',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account" size={size} color={color} />,
          href: isDoctor ? null : undefined,
          tabBarButtonTestID: 'tab-profile',
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: 'Pacientes',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-group" size={size} color={color} />,
          href: isDoctor ? undefined : null,
          tabBarButtonTestID: 'tab-patients',
        }}
      />
      <Tabs.Screen
        name="ecg"
        options={{
          title: 'ECG',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="heart-pulse" size={size} color={color} />,
          tabBarButtonTestID: 'tab-ecg',
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alertas',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="bell" size={size} color={color} />,
          href: isDoctor ? undefined : null,
          tabBarButtonTestID: 'tab-alerts',
        }}
      />
    </Tabs>
  );
}
