# Horizon RPM — API Specification

Base URL: `/api`

All authenticated endpoints require `Authorization: Bearer <jwt>` header. JWT payload: `{ sub: string (user.id), email: string, role: string, organization_id: string }`.

---

## Auth

| Method | Path | Request Body | Response Body | Auth |
|--------|------|-------------|---------------|------|
| POST | /api/auth/login | `{email: string (required), password: string (required)}` | `{token: string, user: {id: string, email: string, name: string, role: string, organization_id: string}}` | No |
| POST | /api/signup | `{email: string (required), password: string (required), name: string (required)}` | `{token: string, user: {id: string, email: string, name: string, role: string, organization_id: string}}` | No |
| GET | /api/auth/me | — | `{user: {id: string, email: string, name: string, role: string, organization_id: string}}` | Bearer |

Notes:
- Login validates bcrypt-hashed password from `user.password` field (exists on DB model but not shown in Prisma — the existing schema's user model has a password field per task description).
- JWT expiry: 7 days.
- Signup creates user with default role PATIENT, associated to a default organization. Also creates a `patient_profile` record with defaults.
- The `role` and `organization_id` fields in the response are essential for frontend role-based routing.

---

## Patient Endpoints

### GET /api/patients/dashboard

Returns aggregated dashboard data for the authenticated patient.

| Method | Path | Request | Response | Auth |
|--------|------|---------|----------|------|
| GET | /api/patients/dashboard | — | See below | Bearer (PATIENT) |

**Response**:
```
{
  enrollment: {
    id: string,
    status: string,
    diagnosis: string | null,
    enrolled_at: ISO8601
  },
  lastVitals: {
    BLOOD_PRESSURE: { value: number, value2: number | null, unit: string, is_abnormal: boolean, recorded_at: ISO8601 } | null,
    HEART_RATE: { value: number, value2: number | null, unit: string, is_abnormal: boolean, recorded_at: ISO8601 } | null,
    GLUCOSE: { value: number, value2: number | null, unit: string, is_abnormal: boolean, recorded_at: ISO8601 } | null
  },
  recentVitals: {
    id: string,
    vital_type: string,
    value: number,
    value2: number | null,
    unit: string,
    is_abnormal: boolean,
    recorded_at: ISO8601
  }[],  // last 5
  recentAlerts: {
    id: string,
    type: string,
    priority: string,
    status: string,
    message: string,
    created_at: ISO8601
  }[]  // last 3
}
```

Backend logic: Find `rpm_enrollment` where `patient_id = user.id` and `status = 'active'`. Query latest vital per type, last 5 vitals, last 3 alerts.

---

### GET /api/patients/profile

| Method | Path | Request | Response | Auth |
|--------|------|---------|----------|------|
| GET | /api/patients/profile | — | See below | Bearer (PATIENT) |

**Response**:
```
{
  id: string,
  user_id: string,
  name: string,
  email: string,
  date_of_birth: ISO8601 | null,
  gender: string | null,
  blood_type: string | null,
  height_cm: number | null,
  weight_kg: number | null,
  emergency_contact_name: string | null,
  emergency_contact_phone: string | null,
  allergies: string[],
  medications: string[],
  conditions: string[],
  insurance_provider: string | null,
  insurance_number: string | null,
  notes: string | null
}
```

Backend: Join `patient_profile` with `user` where `user_id = authenticated user id`.

---

### POST /api/vitals

| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| POST | /api/vitals | `{vital_type: string (required, enum: BLOOD_PRESSURE, HEART_RATE, GLUCOSE), value: number (required), value2: number | null (optional, required for BLOOD_PRESSURE = diastolic), recorded_at: ISO8601 (optional, defaults to now)}` | See below | Bearer (PATIENT) |

**Response**:
```
{
  vital: {
    id: string,
    enrollment_id: string,
    vital_type: string,
    value: number,
    value2: number | null,
    unit: string,
    source: string,
    is_abnormal: boolean,
    recorded_at: ISO8601,
    created_at: ISO8601
  },
  alerts: {
    id: string,
    type: string,
    priority: string,
    message: string,
    created_at: ISO8601
  }[]  // any alerts generated
}
```

**Backend logic**:
1. Find active enrollment for `patient_id = user.id`.
2. Determine `unit` from vital_type: BLOOD_PRESSURE→"mmHg", HEART_RATE→"bpm", GLUCOSE→"mg/dL".
3. Set `source = "manual"`.
4. **Threshold check** against enrollment thresholds:
   - HEART_RATE: value > `alert_threshold_hr_high` → HIGH_HEART_RATE; value < `alert_threshold_hr_low` → LOW_HEART_RATE.
   - BLOOD_PRESSURE: value > `alert_threshold_bp_sys_high` → HIGH_BP (systolic); value2 > `alert_threshold_bp_dia_high` → HIGH_BP (diastolic).
   - GLUCOSE: value > `alert_threshold_glucose_high` → HIGH_GLUCOSE; value < `alert_threshold_glucose_low` → LOW_GLUCOSE.
5. Set `is_abnormal = true` if any threshold exceeded.
6. **Priority logic**: If value exceeds threshold by >20%, priority = CRITICAL. Otherwise WARNING.
7. **Alert messages in Spanish**: e.g., "Presión arterial sistólica elevada: {value} mmHg (umbral: {threshold} mmHg)".
8. Create `rpm_vital` record. Create `rpm_alert` record(s) if thresholds exceeded, with `vital_id` referencing the new vital.
9. Update `enrollment.last_data_received_at`.

---

### GET /api/vitals/:enrollmentId

| Method | Path | Query Params | Response | Auth |
|--------|------|-------------|----------|------|
| GET | /api/vitals/:enrollmentId | `?type=string (optional, e.g. BLOOD_PRESSURE)&page=integer (optional, default 1)&limit=integer (optional, default 20)` | See below | Bearer (PATIENT or DOCTOR) |

**Response**:
```
{
  items: {
    id: string,
    vital_type: string,
    value: number,
    value2: number | null,
    unit: string,
    source: string,
    is_abnormal: boolean,
    recorded_at: ISO8601
  }[],
  total: integer,
  page: integer,
  totalPages: integer
}
```

**Auth logic**: PATIENT can only access their own enrollment. DOCTOR can access enrollments where `assigned_physician_id = user.id`. Ordered by `recorded_at DESC`.

---

### GET /api/alerts/:enrollmentId

| Method | Path | Query Params | Response | Auth |
|--------|------|-------------|----------|------|
| GET | /api/alerts/:enrollmentId | `?status=string (optional)&priority=string (optional)` | See below | Bearer (PATIENT or DOCTOR) |

**Response**:
```
{
  items: {
    id: string,
    enrollment_id: string,
    type: string,
    priority: string,
    status: string,
    message: string,
    vital_id: string | null,
    acknowledged_by: string | null,
    acknowledged_at: ISO8601 | null,
    created_at: ISO8601
  }[]
}
```

Ordered by `created_at DESC`. Same auth logic as vitals.

---

## Doctor Endpoints

### GET /api/doctor/dashboard

| Method | Path | Request | Response | Auth |
|--------|------|---------|----------|------|
| GET | /api/doctor/dashboard | — | See below | Bearer (DOCTOR) |

**Response**:
```
{
  stats: {
    activePatients: integer,
    criticalAlerts: integer,
    pendingAlerts: integer
  },
  recentVitals: {
    id: string,
    vital_type: string,
    value: number,
    value2: number | null,
    unit: string,
    is_abnormal: boolean,
    recorded_at: ISO8601,
    enrollment_id: string,
    patient_name: string
  }[],  // last 10 across all patients
  recentAlerts: {
    id: string,
    type: string,
    priority: string,
    status: string,
    message: string,
    created_at: ISO8601,
    enrollment_id: string,
    patient_name: string
  }[]  // last 5 NEW alerts
}
```

Backend: Query all `rpm_enrollment` where `assigned_physician_id = user.id` and `status = 'active'`. Count patients. Count alerts where `status = 'NEW'` and `priority = 'CRITICAL'`. Count all NEW alerts. Get recent vitals and alerts joined with enrollment for patient_name.

---

### GET /api/doctor/patients

| Method | Path | Request | Response | Auth |
|--------|------|---------|----------|------|
| GET | /api/doctor/patients | — | See below | Bearer (DOCTOR) |

**Response**:
```
{
  patients: {
    enrollment_id: string,
    patient_id: string,
    patient_name: string,
    status: string,
    diagnosis: string | null,
    monitoring_type: string,
    enrolled_at: ISO8601,
    last_data_received_at: ISO8601 | null
  }[]
}
```

Backend: `rpm_enrollment` where `assigned_physician_id = user.id`. Ordered by `patient_name ASC`.

---

### GET /api/doctor/patients/:enrollmentId

| Method | Path | Request | Response | Auth |
|--------|------|---------|----------|------|
| GET | /api/doctor/patients/:enrollmentId | — | See below | Bearer (DOCTOR) |

**Response**:
```
{
  enrollment: {
    id: string,
    patient_id: string,
    patient_name: string,
    status: string,
    monitoring_type: string,
    diagnosis: string | null,
    notes: string | null,
    enrolled_at: ISO8601,
    last_data_received_at: ISO8601 | null,
    thresholds: {
      hr_high: integer,
      hr_low: integer,
      bp_sys_high: integer,
      bp_dia_high: integer,
      glucose_high: integer,
      glucose_low: integer
    }
  },
  recentVitals: {
    id: string,
    vital_type: string,
    value: number,
    value2: number | null,
    unit: string,
    is_abnormal: boolean,
    recorded_at: ISO8601
  }[],  // last 10
  activeAlerts: {
    id: string,
    type: string,
    priority: string,
    status: string,
    message: string,
    vital_id: string | null,
    created_at: ISO8601
  }[]  // where status IN ('NEW', 'ACKNOWLEDGED')
}
```

Auth: Verify `assigned_physician_id = user.id`. Return 403 otherwise.

---

### GET /api/doctor/alerts

| Method | Path | Query Params | Response | Auth |
|--------|------|-------------|----------|------|
| GET | /api/doctor/alerts | `?priority=string (optional, CRITICAL or WARNING)&status=string (optional, NEW or ACKNOWLEDGED)` | See below | Bearer (DOCTOR) |

**Response**:
```
{
  items: {
    id: string,
    enrollment_id: string,
    type: string,
    priority: string,
    status: string,
    message: string,
    patient_name: string,
    created_at: ISO8601
  }[]
}
```

Backend: Join `rpm_alert` with `rpm_enrollment` where `assigned_physician_id = user.id`. Default filter: `status IN ('NEW', 'ACKNOWLEDGED')`. Ordered by `priority DESC, created_at DESC` (CRITICAL first).

---

### PUT /api/alerts/:alertId/acknowledge

| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| PUT | /api/alerts/:alertId/acknowledge | — | See below | Bearer (DOCTOR) |

**Response**:
```
{
  id: string,
  status: string,
  acknowledged_by: string,
  acknowledged_at: ISO8601
}
```

Backend: Verify alert belongs to an enrollment where `assigned_physician_id = user.id`. Set `status = 'ACKNOWLEDGED'`, `acknowledged_by = user.id`, `acknowledged_at = now()`. Return 404 if not found, 403 if not authorized.

---

## Error Responses

All errors follow:
```
{
  statusCode: integer,
  message: string,
  error: string
}
```

- 400: Validation errors
- 401: "No autorizado" (missing/invalid token)
- 403: "Acceso denegado" (wrong role or not assigned)
- 404: "Recurso no encontrado"
- 500: "Error interno del servidor"
