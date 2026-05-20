import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.patient_profile.findUnique({
      where: { user_id: userId },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!profile) {
      throw new NotFoundException('Perfil de paciente no encontrado');
    }
    return {
      id: profile.id,
      user_id: profile.user_id,
      name: profile.user.name,
      email: profile.user.email,
      date_of_birth: profile.date_of_birth,
      gender: profile.gender,
      blood_type: profile.blood_type,
      height_cm: profile.height_cm,
      weight_kg: profile.weight_kg,
      emergency_contact_name: profile.emergency_contact_name,
      emergency_contact_phone: profile.emergency_contact_phone,
      allergies: profile.allergies,
      medications: profile.medications,
      conditions: profile.conditions,
      insurance_provider: profile.insurance_provider,
      insurance_number: profile.insurance_number,
      notes: profile.notes,
    };
  }

  async getDashboard(userId: string) {
    const enrollment = await this.prisma.rpm_enrollment.findFirst({
      where: { patient_id: userId, status: 'active' },
    });
    if (!enrollment) {
      throw new NotFoundException('No se encontr\u00f3 inscripci\u00f3n activa');
    }

    // Last vital per type
    const vitalTypes = ['BLOOD_PRESSURE', 'HEART_RATE', 'GLUCOSE'];
    const lastVitals: Record<string, any> = {};
    for (const vt of vitalTypes) {
      const v = await this.prisma.rpm_vital.findFirst({
        where: { enrollment_id: enrollment.id, vital_type: vt },
        orderBy: { recorded_at: 'desc' },
      });
      lastVitals[vt] = v
        ? { value: v.value, value2: v.value2, unit: v.unit, is_abnormal: v.is_abnormal, recorded_at: v.recorded_at }
        : null;
    }

    const recentVitals = await this.prisma.rpm_vital.findMany({
      where: { enrollment_id: enrollment.id },
      orderBy: { recorded_at: 'desc' },
      take: 5,
      select: { id: true, vital_type: true, value: true, value2: true, unit: true, is_abnormal: true, recorded_at: true },
    });

    const recentAlerts = await this.prisma.rpm_alert.findMany({
      where: { enrollment_id: enrollment.id },
      orderBy: { created_at: 'desc' },
      take: 3,
      select: { id: true, type: true, priority: true, status: true, message: true, created_at: true },
    });

    return {
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        diagnosis: enrollment.diagnosis,
        enrolled_at: enrollment.enrolled_at,
      },
      lastVitals,
      recentVitals,
      recentAlerts,
    };
  }
}
