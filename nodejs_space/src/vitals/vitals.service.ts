import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateVitalDto } from './dto/create-vital.dto';

const UNIT_MAP: Record<string, string> = {
  BLOOD_PRESSURE: 'mmHg',
  HEART_RATE: 'bpm',
  GLUCOSE: 'mg/dL',
};

interface AlertInfo {
  type: string;
  priority: string;
  message: string;
}

@Injectable()
export class VitalsService {
  private readonly logger = new Logger(VitalsService.name);

  constructor(private prisma: PrismaService) {}

  async createVital(userId: string, dto: CreateVitalDto) {
    const enrollment = await this.prisma.rpm_enrollment.findFirst({
      where: { patient_id: userId, status: 'active' },
    });
    if (!enrollment) {
      throw new NotFoundException('No se encontr\u00f3 inscripci\u00f3n activa');
    }

    const unit = UNIT_MAP[dto.vital_type];
    const alerts = this.checkThresholds(enrollment, dto);
    const isAbnormal = alerts.length > 0;

    const vital = await this.prisma.rpm_vital.create({
      data: {
        enrollment_id: enrollment.id,
        vital_type: dto.vital_type,
        value: dto.value,
        value2: dto.value2 ?? null,
        unit,
        source: 'manual',
        is_abnormal: isAbnormal,
        recorded_at: dto.recorded_at ? new Date(dto.recorded_at) : new Date(),
      },
    });

    // Create alerts
    const createdAlerts: any[] = [];
    for (const alert of alerts) {
      const created = await this.prisma.rpm_alert.create({
        data: {
          enrollment_id: enrollment.id,
          type: alert.type,
          priority: alert.priority,
          status: 'NEW',
          message: alert.message,
          vital_id: vital.id,
        },
      });
      createdAlerts.push({
        id: created.id,
        type: created.type,
        priority: created.priority,
        message: created.message,
        created_at: created.created_at,
      });
    }

    // Update last_data_received_at
    await this.prisma.rpm_enrollment.update({
      where: { id: enrollment.id },
      data: { last_data_received_at: new Date() },
    });

    this.logger.log(`Vital creado: ${dto.vital_type} = ${dto.value} para enrollment ${enrollment.id}`);

    return {
      vital: {
        id: vital.id,
        enrollment_id: vital.enrollment_id,
        vital_type: vital.vital_type,
        value: vital.value,
        value2: vital.value2,
        unit: vital.unit,
        source: vital.source,
        is_abnormal: vital.is_abnormal,
        recorded_at: vital.recorded_at,
        created_at: vital.created_at,
      },
      alerts: createdAlerts,
    };
  }

  async getVitals(
    enrollmentId: string,
    userId: string,
    userRole: string,
    query: { type?: string; page?: number; limit?: number },
  ) {
    await this.verifyEnrollmentAccess(enrollmentId, userId, userRole);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { enrollment_id: enrollmentId };
    if (query.type) where.vital_type = query.type;

    const [items, total] = await Promise.all([
      this.prisma.rpm_vital.findMany({
        where,
        orderBy: { recorded_at: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          vital_type: true,
          value: true,
          value2: true,
          unit: true,
          source: true,
          is_abnormal: true,
          recorded_at: true,
        },
      }),
      this.prisma.rpm_vital.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async verifyEnrollmentAccess(enrollmentId: string, userId: string, role: string) {
    const enrollment = await this.prisma.rpm_enrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) {
      throw new NotFoundException('Inscripci\u00f3n no encontrada');
    }
    if (role === 'PATIENT' && enrollment.patient_id !== userId) {
      throw new ForbiddenException('Acceso denegado');
    }
    if (role === 'DOCTOR' && enrollment.assigned_physician_id !== userId) {
      throw new ForbiddenException('Acceso denegado');
    }
    return enrollment;
  }

  private checkThresholds(enrollment: any, dto: CreateVitalDto): AlertInfo[] {
    const alerts: AlertInfo[] = [];

    if (dto.vital_type === 'HEART_RATE') {
      if (dto.value > enrollment.alert_threshold_hr_high) {
        const exceedPct = (dto.value - enrollment.alert_threshold_hr_high) / enrollment.alert_threshold_hr_high;
        alerts.push({
          type: 'HIGH_HEART_RATE',
          priority: exceedPct > 0.2 ? 'CRITICAL' : 'WARNING',
          message: `Frecuencia card\u00edaca elevada: ${dto.value} bpm (umbral: ${enrollment.alert_threshold_hr_high} bpm)`,
        });
      }
      if (dto.value < enrollment.alert_threshold_hr_low) {
        const exceedPct = (enrollment.alert_threshold_hr_low - dto.value) / enrollment.alert_threshold_hr_low;
        alerts.push({
          type: 'LOW_HEART_RATE',
          priority: exceedPct > 0.2 ? 'CRITICAL' : 'WARNING',
          message: `Frecuencia card\u00edaca baja: ${dto.value} bpm (umbral: ${enrollment.alert_threshold_hr_low} bpm)`,
        });
      }
    }

    if (dto.vital_type === 'BLOOD_PRESSURE') {
      if (dto.value > enrollment.alert_threshold_bp_sys_high) {
        const exceedPct = (dto.value - enrollment.alert_threshold_bp_sys_high) / enrollment.alert_threshold_bp_sys_high;
        alerts.push({
          type: 'HIGH_BP',
          priority: exceedPct > 0.2 ? 'CRITICAL' : 'WARNING',
          message: `Presi\u00f3n arterial sist\u00f3lica elevada: ${dto.value} mmHg (umbral: ${enrollment.alert_threshold_bp_sys_high} mmHg)`,
        });
      }
      if (dto.value2 && dto.value2 > enrollment.alert_threshold_bp_dia_high) {
        const exceedPct = (dto.value2 - enrollment.alert_threshold_bp_dia_high) / enrollment.alert_threshold_bp_dia_high;
        alerts.push({
          type: 'HIGH_BP',
          priority: exceedPct > 0.2 ? 'CRITICAL' : 'WARNING',
          message: `Presi\u00f3n arterial diast\u00f3lica elevada: ${dto.value2} mmHg (umbral: ${enrollment.alert_threshold_bp_dia_high} mmHg)`,
        });
      }
    }

    if (dto.vital_type === 'GLUCOSE') {
      if (dto.value > enrollment.alert_threshold_glucose_high) {
        const exceedPct = (dto.value - enrollment.alert_threshold_glucose_high) / enrollment.alert_threshold_glucose_high;
        alerts.push({
          type: 'HIGH_GLUCOSE',
          priority: exceedPct > 0.2 ? 'CRITICAL' : 'WARNING',
          message: `Glucosa elevada: ${dto.value} mg/dL (umbral: ${enrollment.alert_threshold_glucose_high} mg/dL)`,
        });
      }
      if (dto.value < enrollment.alert_threshold_glucose_low) {
        const exceedPct = (enrollment.alert_threshold_glucose_low - dto.value) / enrollment.alert_threshold_glucose_low;
        alerts.push({
          type: 'LOW_GLUCOSE',
          priority: exceedPct > 0.2 ? 'CRITICAL' : 'WARNING',
          message: `Glucosa baja: ${dto.value} mg/dL (umbral: ${enrollment.alert_threshold_glucose_low} mg/dL)`,
        });
      }
    }

    return alerts;
  }
}
