import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://12d004ee00.na106.preview.abacusai.app';

const apiClient = axios.create({
  baseURL: new URL('/api', BASE_URL).toString(),
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

apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_e) {
    // ignore
  }
  return config;
});

let onUnauthorized: (() => void) | null = null;

export const setOnUnauthorized = (cb: () => void) => {
  onUnauthorized = cb;
};

apiClient.interceptors.response.use(
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

export default apiClient;
