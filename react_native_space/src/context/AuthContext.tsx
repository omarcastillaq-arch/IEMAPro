import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/services';
import { setOnUnauthorized } from '../api/client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organization_id: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('auth_token');
    } catch (_e) { /* ignore */ }
    setUser(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      clearAuth();
    });
  }, [clearAuth]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) {
          setIsLoading(false);
          return;
        }
        const res = await authApi.getMe();
        setUser(res?.data?.user ?? null);
      } catch (_e) {
        await clearAuth();
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();
  }, [clearAuth]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const data = res?.data;
    if (data?.token) {
      await AsyncStorage.setItem('auth_token', data.token);
    }
    setUser(data?.user ?? null);
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const res = await authApi.signup(email, password, name);
    const data = res?.data;
    if (data?.token) {
      await AsyncStorage.setItem('auth_token', data.token);
    }
    setUser(data?.user ?? null);
  }, []);

  const logout = useCallback(async () => {
    await clearAuth();
  }, [clearAuth]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
