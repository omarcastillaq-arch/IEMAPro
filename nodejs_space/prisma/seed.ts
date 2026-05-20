import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Organization "Prometheus"
  const org = await prisma.organization.upsert({
    where: { slug: 'prometheus' },
    update: {},
    create: {
      name: 'Prometheus',
      slug: 'prometheus',
      type: 'clinic',
      email: 'admin@prometheus.mx',
      phone: '+52 55 1234 5678',
      address_city: 'Ciudad de M\u00e9xico',
      address_state: 'CDMX',
      address_country: 'M\u00e9xico',
      plan: 'PRO',
      subscription_status: 'active',
      settings_timezone: 'America/Mexico_City',
      settings_language: 'es',
      settings_currency: 'MXN',
    },
  });
  console.log(`Organization: ${org.name} (${org.id})`);

  // 2. Admin user
  const adminPass = await bcrypt.hash('johndoe123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      name: 'John Doe',
      password: adminPass,
      role: 'ORG_ADMIN',
      organization_id: org.id,
    },
  });
  console.log(`Admin: ${admin.email} (${admin.id})`);

  // 3. Doctor user
  const doctorPass = await bcrypt.hash('doctor123', 10);
  const doctor = await prisma.user.upsert({
    where: { email: 'doctor@prometheus.mx' },
    update: {},
    create: {
      email: 'doctor@prometheus.mx',
      name: 'Dr. Carlos Mendoza',
      password: doctorPass,
      role: 'DOCTOR',
      organization_id: org.id,
    },
  });
  console.log(`Doctor: ${doctor.email} (${doctor.id})`);

  // 4. Patient user
  const patientPass = await bcrypt.hash('paciente123', 10);
  const patient = await prisma.user.upsert({
    where: { email: 'paciente@prometheus.mx' },
    update: {},
    create: {
      email: 'paciente@prometheus.mx',
      name: 'Mar\u00eda Garc\u00eda',
      password: patientPass,
      role: 'PATIENT',
      organization_id: org.id,
    },
  });
  console.log(`Patient: ${patient.email} (${patient.id})`);

  // 5. Patient profile
  await prisma.patient_profile.upsert({
    where: { user_id: patient.id },
    update: {},
    create: {
      user_id: patient.id,
      organization_id: org.id,
      date_of_birth: new Date('1985-03-15'),
      gender: 'F',
      blood_type: 'O+',
      height_cm: 162,
      weight_kg: 68,
      emergency_contact_name: 'Roberto Garc\u00eda',
      emergency_contact_phone: '+52 55 9876 5432',
      allergies: ['Penicilina'],
      medications: ['Metformina 850mg', 'Losart\u00e1n 50mg'],
      conditions: ['Diabetes Tipo 2', 'Hipertensi\u00f3n'],
      insurance_provider: 'IMSS',
      insurance_number: 'IMSS-2024-78901',
    },
  });
  console.log('Patient profile created');

  // 6. RPM Enrollment
  const enrollmentKey = { organization_id: org.id, patient_id: patient.id };
  const enrollment = await prisma.rpm_enrollment.upsert({
    where: { organization_id_patient_id: enrollmentKey },
    update: {},
    create: {
      organization_id: org.id,
      patient_id: patient.id,
      patient_name: 'Mar\u00eda Garc\u00eda',
      status: 'active',
      monitoring_type: 'continuous',
      assigned_physician_id: doctor.id,
      diagnosis: 'Diabetes Tipo 2, Hipertensi\u00f3n Arterial',
      notes: 'Paciente en monitoreo continuo. Requiere control estricto de glucosa y presi\u00f3n arterial.',
      alert_threshold_hr_high: 120,
      alert_threshold_hr_low: 50,
      alert_threshold_bp_sys_high: 140,
      alert_threshold_bp_dia_high: 90,
      alert_threshold_glucose_high: 180,
      alert_threshold_glucose_low: 70,
      price_per_month: 1500,
    },
  });
  console.log(`Enrollment: ${enrollment.id}`);

  // 7. Sample vitals over the past 7 days
  const now = new Date();
  const vitalsData = [
    { vital_type: 'HEART_RATE', value: 72, value2: null, unit: 'bpm', is_abnormal: false, recorded_at: daysAgo(now, 6) },
    { vital_type: 'BLOOD_PRESSURE', value: 128, value2: 82, unit: 'mmHg', is_abnormal: false, recorded_at: daysAgo(now, 6) },
    { vital_type: 'GLUCOSE', value: 145, value2: null, unit: 'mg/dL', is_abnormal: false, recorded_at: daysAgo(now, 5) },
    { vital_type: 'HEART_RATE', value: 135, value2: null, unit: 'bpm', is_abnormal: true, recorded_at: daysAgo(now, 4) },
    { vital_type: 'BLOOD_PRESSURE', value: 155, value2: 95, unit: 'mmHg', is_abnormal: true, recorded_at: daysAgo(now, 3) },
    { vital_type: 'GLUCOSE', value: 210, value2: null, unit: 'mg/dL', is_abnormal: true, recorded_at: daysAgo(now, 2) },
    { vital_type: 'HEART_RATE', value: 78, value2: null, unit: 'bpm', is_abnormal: false, recorded_at: daysAgo(now, 2) },
    { vital_type: 'BLOOD_PRESSURE', value: 132, value2: 85, unit: 'mmHg', is_abnormal: false, recorded_at: daysAgo(now, 1) },
    { vital_type: 'GLUCOSE', value: 165, value2: null, unit: 'mg/dL', is_abnormal: false, recorded_at: daysAgo(now, 1) },
    { vital_type: 'HEART_RATE', value: 68, value2: null, unit: 'bpm', is_abnormal: false, recorded_at: daysAgo(now, 0) },
  ];

  const createdVitals: any[] = [];
  for (const v of vitalsData) {
    const vital = await prisma.rpm_vital.create({
      data: {
        enrollment_id: enrollment.id,
        vital_type: v.vital_type,
        value: v.value,
        value2: v.value2,
        unit: v.unit,
        source: 'manual',
        is_abnormal: v.is_abnormal,
        recorded_at: v.recorded_at,
      },
    });
    createdVitals.push(vital);
  }
  console.log(`Created ${createdVitals.length} vitals`);

  // Find abnormal vitals for alert references
  const highHrVital = createdVitals.find((v) => v.vital_type === 'HEART_RATE' && v.is_abnormal);
  const highBpVital = createdVitals.find((v) => v.vital_type === 'BLOOD_PRESSURE' && v.is_abnormal);
  const highGlucoseVital = createdVitals.find((v) => v.vital_type === 'GLUCOSE' && v.is_abnormal);

  // 8. Sample alerts
  await prisma.rpm_alert.create({
    data: {
      enrollment_id: enrollment.id,
      type: 'HIGH_GLUCOSE',
      priority: 'CRITICAL',
      status: 'NEW',
      message: 'Glucosa elevada: 210 mg/dL (umbral: 180 mg/dL)',
      vital_id: highGlucoseVital?.id ?? null,
    },
  });

  await prisma.rpm_alert.create({
    data: {
      enrollment_id: enrollment.id,
      type: 'HIGH_BP',
      priority: 'WARNING',
      status: 'ACKNOWLEDGED',
      message: 'Presi\u00f3n arterial sist\u00f3lica elevada: 155 mmHg (umbral: 140 mmHg)',
      vital_id: highBpVital?.id ?? null,
      acknowledged_by: doctor.id,
      acknowledged_at: daysAgo(now, 2),
    },
  });

  await prisma.rpm_alert.create({
    data: {
      enrollment_id: enrollment.id,
      type: 'HIGH_HEART_RATE',
      priority: 'CRITICAL',
      status: 'NEW',
      message: 'Frecuencia card\u00edaca elevada: 135 bpm (umbral: 120 bpm)',
      vital_id: highHrVital?.id ?? null,
    },
  });

  console.log('Created 3 alerts');

  // Update enrollment last_data_received_at
  await prisma.rpm_enrollment.update({
    where: { id: enrollment.id },
    data: { last_data_received_at: now },
  });

  console.log('Seed complete!');
}

function daysAgo(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  d.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
  return d;
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
