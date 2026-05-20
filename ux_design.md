# Horizon RPM — UX Specification (Spanish UI)

## Design Direction

- **Theme**: Dark mode. Backgrounds: `#0A0A0A` (base), `#111111` (surface), `#1A1A1A` (card). Never pure black.
- **Palette**: Midnight Indigo primary `#4F46E5` + Cyan accent `#06B6D4`. Gradient buttons `[#4F46E5, #06B6D4]`. Critical alerts: `#EF4444`. Warning: `#F59E0B`. Success: `#10B981`.
- **Typography**: Google Fonts — headings: **Outfit** (semibold/bold), body: **Inter** (regular/medium). Display 32px → Heading 22px → Body 16px → Caption 13px. Text colors: `#F1F5F9` (primary), `#94A3B8` (secondary), `#64748B` (tertiary).
- **Backgrounds**: Subtle radial gradient overlay from `#4F46E510` top-center fading to transparent.
- **Cards**: `bg #161616`, border-radius 16px, 1px border `#ffffff08`. Glass effect on dashboard stat cards.
- **Spacing**: 8pt grid. Padding: screen 16px, card inner 16px. Border radius: sm 8, md 12, lg 16, xl 24.

## Animation & Motion

- Screen transitions: fade + slide-right for push, slide-left for pop (200ms).
- Button press: scale 0.97 spring + light haptic.
- List items: staggered fade-in on mount (50ms delay per item).
- Loading: skeleton shimmer on all data screens.
- Pull-to-refresh on dashboard, vitals history, patients list, alerts list.
- Charts: animated draw-in on mount.
- Respect `reduceMotionEnabled`.

## File Structure

```
app/
  _layout.tsx              → Root layout: AuthProvider wrapper, loads fonts. If isLoading → splash. Routes to /auth or /tabs via Slot.
  auth/
    _layout.tsx            → If isAuthenticated, <Redirect href="/tabs" />. Else <Stack>.
    login.tsx              → Login screen
  tabs/
    _layout.tsx            → If !isAuthenticated, <Redirect href="/auth/login" />. Reads user.role. PATIENT: 3 tabs (Inicio, Signos, Perfil). DOCTOR: 3 tabs (Inicio, Pacientes, Alertas).
    index.tsx              → Dashboard (role-aware: patient or doctor dashboard)
    vitals.tsx             → Patient only: Vitals history
    profile.tsx            → Patient only: Profile
    patients.tsx           → Doctor only: Patients list
    alerts.tsx             → Doctor only: Alerts list
  capture-vital.tsx        → Patient: Capture vital form (outside tabs)
  patient-detail/
    [enrollmentId]/
      index.tsx            → Doctor: Patient detail with vitals + charts + alerts
```

Note: `tabs/_layout.tsx` conditionally renders exactly 3 `<Tabs.Screen>` based on role. The other files exist but are hidden via `href: null` for the opposite role.

## Screens

### 1. Login — `auth/login.tsx`

**Propósito**: Inicio de sesión con email y contraseña.

**Layout**:
- Top: Horizon logo (text-based "HORIZON RPM" in Outfit bold 36px, gradient text).
- Subtitle: "Monitoreo Remoto de Pacientes" in secondary text.
- Form card (glass):
  - Input: "Correo electrónico" — floating label, email keyboard, validation.
  - Input: "Contraseña" — floating label, secure entry, eye toggle.
  - Gradient button: "Iniciar Sesión" — full width, loading state.
- Error banner below button (shake animation on error).
- Bottom: app version caption.

**Actions**:
- Tap "Iniciar Sesión" → calls `login(email, password)` from AuthProvider. On success, AuthProvider state updates; the layout switches to the authenticated tab group. On failure, show error: "Credenciales inválidas".

---

### 2. Patient Dashboard — `tabs/index.tsx` (role=PATIENT)

**Propósito**: Vista general del paciente con estadísticas rápidas y alertas recientes.

**Layout**:
- Header: "¡Hola, {name}!" (Outfit 28px). Subtitle: date in Spanish locale.
- **Stat cards row** (horizontal scroll, 3 glass cards):
  - "Presión Arterial" — last BP value `{systolic}/{diastolic} mmHg`, timestamp, abnormal indicator (red dot if is_abnormal).
  - "Frecuencia Cardíaca" — last HR value `{value} bpm`, timestamp.
  - "Glucosa" — last glucose value `{value} mg/dL`, timestamp.
  - Each card shows "Sin datos" if no vitals of that type exist.
- **Gradient FAB** bottom-right: "+" icon → navigates to `/capture-vital`.
- **Section**: "Alertas Recientes" — last 3 alerts as compact cards. Each shows: priority badge (CRÍTICA red / ADVERTENCIA amber), message, date. If none: empty state "Sin alertas recientes ✓" with success color.
- **Section**: "Últimos Registros" — last 5 vitals as list items. Each: type icon, formatted value, date, abnormal badge.

**Data needs**: `GET /api/patients/dashboard` → returns lastVitals (by type), recentAlerts, recentVitals.

---

### 3. Doctor Dashboard — `tabs/index.tsx` (role=DOCTOR)

**Propósito**: Vista general del doctor con métricas y actividad reciente.

**Layout**:
- Header: "Dr. {name}" (Outfit 28px). Subtitle: "Panel de Control".
- **Stat cards row** (3 glass cards):
  - "Pacientes Activos" — count, indigo icon.
  - "Alertas Críticas" — count of CRITICAL+NEW alerts, red icon.
  - "Alertas Pendientes" — count of all NEW alerts, amber icon.
- **Section**: "Actividad Reciente" — last 10 vitals across all enrolled patients. Each item: patient name, vital type + value, timestamp, abnormal badge. Tap → push `/patient-detail/[enrollmentId]`.
- **Section**: "Alertas Recientes" — last 5 NEW alerts. Priority badge, patient name, message, date. Tap → push `/patient-detail/[enrollmentId]`.
- Logout icon button in header top-right.

**Data needs**: `GET /api/doctor/dashboard` → returns stats, recentVitals, recentAlerts.

---

### 4. Capture Vital — `capture-vital.tsx`

**Propósito**: Paciente registra un signo vital manualmente.

**Layout**:
- Header with back arrow: "Registrar Signo Vital".
- **Type selector**: 3 large selectable cards in a row:
  - "Presión Arterial" (heart icon)
  - "Frecuencia Cardíaca" (pulse icon)
  - "Glucosa" (droplet icon)
- **Value inputs** (conditional on type):
  - BP: two inputs side by side — "Sistólica" and "Diastólica" (numeric keyboard). Unit label "mmHg".
  - HR: single input "Valor" (numeric). Unit label "bpm".
  - Glucose: single input "Valor" (numeric). Unit label "mg/dL".
- **Date/Time picker**: "Fecha y hora de medición" — defaults to now. Tap opens native date-time picker.
- **Gradient button**: "Guardar Registro" — full width.
- On success: show success toast "Signo vital registrado", pop back to previous screen.
- On error: show error banner.
- Validation: all value fields required, systolic 60-250, diastolic 30-150, HR 30-220, glucose 20-600.

**Data needs**: `POST /api/vitals`.

---

### 5. Vitals History — `tabs/vitals.tsx` (PATIENT)

**Propósito**: Historial de signos vitales del paciente con filtro por tipo.

**Layout**:
- Header: "Mis Signos Vitales".
- **Filter chips** (horizontal scroll): "Todos", "Presión Arterial", "Frecuencia Cardíaca", "Glucosa". Active chip uses gradient bg.
- **List** (FlashList): Each item:
  - Left: type icon with colored circle bg.
  - Center: type label, formatted value (BP: "120/80 mmHg", HR: "72 bpm", Glucose: "95 mg/dL"), date/time.
  - Right: red "⚠" badge if is_abnormal.
- Empty state: "No hay registros" with illustration placeholder.
- Pull-to-refresh.

**Data needs**: `GET /api/vitals/:enrollmentId?type=&page=&limit=`.

---

### 6. Patient Profile — `tabs/profile.tsx` (PATIENT)

**Propósito**: Información personal del paciente.

**Layout**:
- Header: "Mi Perfil".
- **Avatar circle** with initials, name (Outfit 24px), email (secondary).
- **Info sections** (card groups):
  - "Información Personal": Fecha de nacimiento, Género, Tipo de sangre, Altura, Peso.
  - "Información Médica": Alergias (chips), Medicamentos (chips), Condiciones (chips).
  - "Contacto de Emergencia": Nombre, Teléfono.
  - "Seguro Médico": Proveedor, Número.
- Each field: label (caption, secondary) + value (body). Show "—" for null fields.
- **Logout button** at bottom: outlined red, "Cerrar Sesión". Calls `logout()` from AuthProvider; layout switches to unauthenticated stack.

**Data needs**: `GET /api/patients/profile`.

---

### 7. Patients List — `tabs/patients.tsx` (DOCTOR)

**Propósito**: Lista de pacientes asignados al doctor.

**Layout**:
- Header: "Mis Pacientes".
- **Search bar**: "Buscar paciente..." — filters by name locally.
- **List** (FlashList): Each item (card style):
  - Avatar circle with initials.
  - Patient name (bold), status badge ("Activo" green, "Pausado" amber).
  - Subtitle: diagnosis or "Sin diagnóstico".
  - Right: last vital date caption, chevron.
  - Tap → push `/patient-detail/[enrollmentId]`.
- Empty state: "No tiene pacientes asignados".

**Data needs**: `GET /api/doctor/patients`.

---

### 8. Patient Detail — `patient-detail/[enrollmentId]/index.tsx` (DOCTOR)

**Propósito**: Detalle completo de un paciente con vitales, gráficas y alertas.

**Layout**:
- Header with back arrow: patient name.
- **Info card**: Name, status badge, diagnosis, enrolled date, monitoring type.
- **Tab-like segments** (react-native-paper SegmentedButtons): "Signos Vitales" | "Gráficas" | "Alertas".

**Segment: Signos Vitales**:
- Last 10 vitals as list. Same format as vitals history.

**Segment: Gráficas**:
- **Chart selector chips**: "Presión Arterial", "Frecuencia Cardíaca", "Glucosa".
- Line chart (react-native-chart-kit) showing selected vital type over time. BP shows two lines (sys/dia). Threshold lines shown as dashed red horizontal lines.
- X-axis: dates. Y-axis: values.

**Segment: Alertas**:
- Active alerts (NEW + ACKNOWLEDGED) for this patient.
- Each alert card: priority badge, type, message, date.
- "Reconocer" button on NEW alerts → calls acknowledge endpoint → updates status to ACKNOWLEDGED.

**Data needs**: `GET /api/doctor/patients/:enrollmentId`, `GET /api/vitals/:enrollmentId`, `GET /api/alerts/:enrollmentId`, `PUT /api/alerts/:alertId/acknowledge`.

---

### 9. Alerts List — `tabs/alerts.tsx` (DOCTOR)

**Propósito**: Todas las alertas de pacientes del doctor.

**Layout**:
- Header: "Alertas".
- **Filter chips**: "Todas", "Críticas", "Advertencia". Second row: "Nuevas", "Reconocidas".
- **List** (FlashList): Each alert card:
  - Priority badge (CRÍTICA red bg, ADVERTENCIA amber bg).
  - Patient name (from enrollment patient_name).
  - Alert message.
  - Date/time.
  - Status badge: "NUEVA" blue, "RECONOCIDA" gray.
  - If NEW: "Reconocer" text button → acknowledge.
  - Tap card → push `/patient-detail/[enrollmentId]`.
- Empty state: "No hay alertas pendientes ✓".

**Data needs**: `GET /api/doctor/alerts?priority=&status=`.

## Navigation Summary

- **Unauthenticated**: Stack with login screen only.
- **Authenticated PATIENT**: 3-tab layout (Inicio / Signos Vitales / Perfil) + capture-vital as stack push.
- **Authenticated DOCTOR**: 3-tab layout (Inicio / Pacientes / Alertas) + patient-detail as stack push.
- Tab icons: Inicio = home, Signos Vitales = activity/pulse, Perfil = person, Pacientes = people, Alertas = bell.
- Tab labels in Spanish.

## Accessibility
- All touch targets ≥ 44pt.
- Contrast ≥ 4.5:1 for text on dark backgrounds.
- Accessible labels on all icons and badges.
- Screen reader: priority badges announce "Alerta crítica" / "Alerta de advertencia".
