import localClient, { platformClient } from './client';

// ── Auth (local backend - JWT) ──
export const authApi = {
  login: (email: string, password: string) =>
    localClient.post('/auth/login', { email, password }),
  signup: (email: string, password: string, name: string) =>
    localClient.post('/signup', { email, password, name }),
  getMe: () => localClient.get('/auth/me'),
};

// ── Patient (local backend for write, platform for read) ──
export const patientApi = {
  getDashboard: () => localClient.get('/patients/dashboard'),
  getProfile: () => localClient.get('/patients/profile'),
  // Platform B2C endpoints
  getPlatformDashboard: (userId: string) =>
    platformClient.get(`/b2c/patients/${userId}/dashboard`),
  getPlatformProfile: (userId: string) =>
    platformClient.get(`/b2c/patients/${userId}`),
  updatePlatformProfile: (userId: string, data: Record<string, unknown>) =>
    platformClient.patch(`/b2c/patients/${userId}`, data),
};

// ── Vitals (local for create, platform for read) ──
export const vitalsApi = {
  create: (data: {
    vital_type: string;
    value: number;
    value2?: number;
    recorded_at?: string;
  }) => localClient.post('/vitals', data),
  getByEnrollment: (enrollmentId: string, params?: { type?: string; page?: number; limit?: number }) =>
    localClient.get(`/vitals/${enrollmentId}`, { params }),
  // Platform RPM endpoints
  getPlatformVitals: (params?: {
    enrollmentId?: string;
    vitalType?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) => platformClient.get('/rpm/vitals', { params }),
  getLatestByEnrollment: (enrollmentId: string) =>
    platformClient.get(`/rpm/vitals/latest/${enrollmentId}`),
};

// ── Alerts ──
export const alertsApi = {
  getByEnrollment: (enrollmentId: string, params?: { status?: string; priority?: string }) =>
    localClient.get(`/alerts/${enrollmentId}`, { params }),
  acknowledge: (alertId: string) =>
    localClient.put(`/alerts/${alertId}/acknowledge`),
  // Platform RPM alerts
  getPlatformAlerts: (params?: {
    enrollmentId?: string;
    priority?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => platformClient.get('/rpm/alerts', { params }),
  acknowledgePlatform: (alertId: string) =>
    platformClient.patch(`/rpm/alerts/${alertId}/acknowledge`),
  resolvePlatform: (alertId: string) =>
    platformClient.patch(`/rpm/alerts/${alertId}/resolve`),
};

// ── Doctor ──
export const doctorApi = {
  getDashboard: () => localClient.get('/doctor/dashboard'),
  getPatients: () => localClient.get('/doctor/patients'),
  getPatientDetail: (enrollmentId: string) =>
    localClient.get(`/doctor/patients/${enrollmentId}`),
  getAlerts: (params?: { priority?: string; status?: string }) =>
    localClient.get('/doctor/alerts', { params }),
  // Platform RPM endpoints
  getPlatformEnrollments: (params?: {
    status?: string;
    patientId?: string;
    page?: number;
    limit?: number;
  }) => platformClient.get('/rpm/enrollments', { params }),
  getPlatformEnrollmentDetail: (enrollmentId: string) =>
    platformClient.get(`/rpm/enrollments/${enrollmentId}`),
  getPlatformAnalytics: () =>
    platformClient.get('/rpm/analytics'),
  getPlatformMetrics: (enrollmentId: string) =>
    platformClient.get(`/rpm/metrics/${enrollmentId}`),
};

// ── Reports (Platform only - PDF generation) ──
export const reportsApi = {
  getPatientReport: (enrollmentId: string) =>
    platformClient.get(`/reports/patient/${enrollmentId}`, { responseType: 'blob' }),
  getOrganizationReport: () =>
    platformClient.get('/reports/organization', { responseType: 'blob' }),
  getAlertsReport: (params?: { status?: string }) =>
    platformClient.get('/reports/alerts', { params, responseType: 'blob' }),
  getAnalyticsReport: () =>
    platformClient.get('/reports/analytics', { responseType: 'blob' }),
};

// ── Organizations (Platform only) ──
export const organizationApi = {
  getOwn: () => platformClient.get('/organizations/me'),
  getById: (id: string) => platformClient.get(`/organizations/${id}`),
  getStats: (id: string) => platformClient.get(`/organizations/${id}/stats`),
};
