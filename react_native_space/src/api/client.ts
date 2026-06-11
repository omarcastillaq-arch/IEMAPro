import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend local (horizon-rpm-api) para auth y crear vitales
const LOCAL_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://horizon-rpm-api.abacusai.app';

// Plataforma principal para lectura de datos (RPM, B2C, Reports, Analytics)
const PLATFORM_BASE = 'https://apihorizonmedical.abacusai.app';

const createClient = (baseURL: string) => {
  const client = axios.create({
    baseURL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
    transformRequest: [
      (data: unknown, headers: Record<string, string> | undefined) => {
        if (data && typeof data === 'object' && headers?.['Content-Type'] === 'application/json') {
          return JSON.stringify(data);
        }
        return data;
      },
    ],
  });
  return client;
};

// ── Local API client (JWT auth) ──
const localClient = createClient(new URL('/api', LOCAL_BASE).toString());

localClient.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_e) { /* ignore */ }
  return config;
});

let onUnauthorized: (() => void) | null = null;

export const setOnUnauthorized = (cb: () => void) => {
  onUnauthorized = cb;
};

localClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error?.response?.status === 401) {
      try {
        await AsyncStorage.removeItem('auth_token');
      } catch (_e) { /* ignore */ }
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

// ── Platform API client (X-API-Key auth) ──
const platformClient = createClient(new URL('/api', PLATFORM_BASE).toString());

platformClient.interceptors.request.use(async (config) => {
  try {
    const apiKey = await AsyncStorage.getItem('platform_api_key');
    if (apiKey && config.headers) {
      config.headers['X-API-Key'] = apiKey;
    }
  } catch (_e) { /* ignore */ }
  return config;
});

platformClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    return Promise.reject(error);
  },
);

export { platformClient };
export default localClient;
