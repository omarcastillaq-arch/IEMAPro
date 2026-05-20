export interface VitalReading {
  id: string;
  vital_type: string;
  value: number;
  value2?: number | null;
  unit: string;
  source?: string;
  is_abnormal: boolean;
  recorded_at: string;
  enrollment_id?: string;
  patient_name?: string;
}

export interface AlertItem {
  id: string;
  enrollment_id: string;
  type: string;
  priority: string;
  status: string;
  message: string;
  vital_id?: string | null;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  created_at: string;
  patient_name?: string;
}

export interface Enrollment {
  id: string;
  patient_id?: string;
  patient_name?: string;
  status: string;
  diagnosis?: string | null;
  monitoring_type?: string;
  enrolled_at: string;
  last_data_received_at?: string | null;
  notes?: string | null;
  thresholds?: {
    hr_high: number;
    hr_low: number;
    bp_sys_high: number;
    bp_dia_high: number;
    glucose_high: number;
    glucose_low: number;
  };
}

export interface PatientProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  date_of_birth?: string | null;
  gender?: string | null;
  blood_type?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  allergies: string[];
  medications: string[];
  conditions: string[];
  insurance_provider?: string | null;
  insurance_number?: string | null;
  notes?: string | null;
}

export interface LastVitals {
  BLOOD_PRESSURE?: { value: number; value2: number | null; unit: string; is_abnormal: boolean; recorded_at: string } | null;
  HEART_RATE?: { value: number; value2: number | null; unit: string; is_abnormal: boolean; recorded_at: string } | null;
  GLUCOSE?: { value: number; value2: number | null; unit: string; is_abnormal: boolean; recorded_at: string } | null;
}

export interface PatientDashboardData {
  enrollment: Enrollment;
  lastVitals: LastVitals;
  recentVitals: VitalReading[];
  recentAlerts: AlertItem[];
}

export interface DoctorDashboardData {
  stats: {
    activePatients: number;
    criticalAlerts: number;
    pendingAlerts: number;
  };
  recentVitals: VitalReading[];
  recentAlerts: AlertItem[];
}

export interface DoctorPatient {
  enrollment_id: string;
  patient_id: string;
  patient_name: string;
  status: string;
  diagnosis: string | null;
  monitoring_type: string;
  enrolled_at: string;
  last_data_received_at: string | null;
}
