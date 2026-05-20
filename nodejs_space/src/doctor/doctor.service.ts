import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class DoctorService {
  private readonly logger = new Logger(DoctorService.name);

  constructor(private prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const enrollments = await this.prisma.rpm_enrollment.findMany({
      where: { assigned_physician_id: userId, status: 'active' },
    });
    const enrollmentIds = enrollments.map((e: any) => e.id);

    const [criticalAlerts, pendingAlerts] = await Promise.all([
      this.prisma.rpm_alert.count({
        where: { enrollment_id: { in: enrollmentIds }, status: 'NEW', priority: 'CRITICAL' },
      }),
      this.prisma.rpm_alert.count({
        where: { enrollment_id: { in: enrollmentIds }, status: 'NEW' },
      }),
    ]);

    const recentVitals = await this.prisma.rpm_vital.findMany({
      where: { enrollment_id: { in: enrollmentIds } },
      orderBy: { recorded_at: 'desc' },
      take: 10,
      include: { enrollment: { select: { patient_name: true, id: true } } },
    });

    const recentAlerts = await this.prisma.rpm_alert.findMany({
      where: { enrollment_id: { in: enrollmentIds }, status: 'NEW' },
      orderBy: { created_at: 'desc' },
      take: 5,
      include: { enrollment: { select: { patient_name: true, id: true } } },
    });

    return {
      stats: {
        activePatients: enrollments.length,
        criticalAlerts,
        pendingAlerts,
      },
      recentVitals: recentVitals.map((v: any) => ({
        id: v.id,
        vital_type: v.vital_type,
        value: v.value,
        value2: v.value2,
        unit: v.unit,
        is_abnormal: v.is_abnormal,
        recorded_at: v.recorded_at,
        enrollment_id: v.enrollment.id,
        patient_name: v.enrollment.patient_name,
      })),
      recentAlerts: recentAlerts.map((a: any) => ({
        id: a.id,
        type: a.type,
        priority: a.priority,
        status: a.status,
        message: a.message,
        created_at: a.created_at,
        enrollment_id: a.enrollment.id,
        patient_name: a.enrollment.patient_name,
      })),
    };
  }

  async getPatients(userId: string) {
    const enrollments = await this.prisma.rpm_enrollment.findMany({
      where: { assigned_physician_id: userId },
      orderBy: { patient_name: 'asc' },
    });

    return {
      patients: enrollments.map((e: any) => ({
        enrollment_id: e.id,
        patient_id: e.patient_id,
        patient_name: e.patient_name,
        status: e.status,
        diagnosis: e.diagnosis,
        monitoring_type: e.monitoring_type,
        enrolled_at: e.enrolled_at,
        last_data_received_at: e.last_data_received_at,
      })),
    };
  }

  async getPatientDetail(enrollmentId: string, userId: string) {
    const enrollment = await this.prisma.rpm_enrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) {
      throw new NotFoundException('Inscripción no encontrada');
    }
    if (enrollment.assigned_physician_id !== userId) {
      throw new ForbiddenException('Acceso denegado');
    }

    const recentVitals = await this.prisma.rpm_vital.findMany({
      where: { enrollment_id: enrollmentId },
      orderBy: { recorded_at: 'desc' },
      take: 10,
      select: {
        id: true,
        vital_type: true,
        value: true,
        value2: true,
        unit: true,
        is_abnormal: true,
        recorded_at: true,
      },
    });

    const activeAlerts = await this.prisma.rpm_alert.findMany({
      where: {
        enrollment_id: enrollmentId,
        status: { in: ['NEW', 'ACKNOWLEDGED'] },
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        type: true,
        priority: true,
        status: true,
        message: true,
        vital_id: true,
        created_at: true,
      },
    });

    return {
      enrollment: {
        id: enrollment.id,
        patient_id: enrollment.patient_id,
        patient_name: enrollment.patient_name,
        status: enrollment.status,
        monitoring_type: enrollment.monitoring_type,
        diagnosis: enrollment.diagnosis,
        notes: enrollment.notes,
        enrolled_at: enrollment.enrolled_at,
        last_data_received_at: enrollment.last_data_received_at,
        thresholds: {
          hr_high: enrollment.alert_threshold_hr_high,
          hr_low: enrollment.alert_threshold_hr_low,
          bp_sys_high: enrollment.alert_threshold_bp_sys_high,
          bp_dia_high: enrollment.alert_threshold_bp_dia_high,
          glucose_high: enrollment.alert_threshold_glucose_high,
          glucose_low: enrollment.alert_threshold_glucose_low,
        },
      },
      recentVitals,
      activeAlerts,
    };
  }

  async getAlerts(userId: string, query: { priority?: string; status?: string }) {
    const enrollments = await this.prisma.rpm_enrollment.findMany({
      where: { assigned_physician_id: userId },
    });
    const enrollmentIds = enrollments.map((e: any) => e.id);

    const where: Record<string, unknown> = {
      enrollment_id: { in: enrollmentIds },
    };
    if (query.status) {
      where.status = query.status;
    } else {
      where.status = { in: ['NEW', 'ACKNOWLEDGED'] };
    }
    if (query.priority) where.priority = query.priority;

    const items = await this.prisma.rpm_alert.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
      include: { enrollment: { select: { patient_name: true } } },
    });

    return {
      items: items.map((a: any) => ({
        id: a.id,
        enrollment_id: a.enrollment_id,
        type: a.type,
        priority: a.priority,
        status: a.status,
        message: a.message,
        patient_name: a.enrollment.patient_name,
        created_at: a.created_at,
      })),
    };
  }
}
