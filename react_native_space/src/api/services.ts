import apiClient from './client';

// ── Auth ──
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  signup: (email: string, password: string, name: string) =>
    apiClient.post('/signup', { email, password, name }),
  getMe: () => apiClient.get('/auth/me'),
};

// ── Patient ──
export const patientApi = {
  getDashboard: () => apiClient.get('/patients/dashboard'),
  getProfile: () => apiClient.get('/patients/profile'),
};

// ── Vitals ──
export const vitalsApi = {
  create: (data: {
    vital_type: string;
    value: number;
    value2?: number;
    recorded_at?: string;
  }) => apiClient.post('/vitals', data),
  getByEnrollment: (enrollmentId: string, params?: { type?: string; page?: number; limit?: number }) =>
    apiClient.get(`/vitals/${enrollmentId}`, { params }),
};

// ── Alerts ──
export const alertsApi = {
  getByEnrollment: (enrollmentId: string, params?: { status?: string; priority?: string }) =>
    apiClient.get(`/alerts/${enrollmentId}`, { params }),
  acknowledge: (alertId: string) =>
    apiClient.put(`/alerts/${alertId}/acknowledge`),
};

// ── Doctor ──
export const doctorApi = {
  getDashboard: () => apiClient.get('/doctor/dashboard'),
  getPatients: () => apiClient.get('/doctor/patients'),
  getPatientDetail: (enrollmentId: string) =>
    apiClient.get(`/doctor/patients/${enrollmentId}`),
  getAlerts: (params?: { priority?: string; status?: string }) =>
    apiClient.get('/doctor/alerts', { params }),
};
