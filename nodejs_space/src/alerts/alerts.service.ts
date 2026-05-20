import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private prisma: PrismaService) {}

  async getAlertsByEnrollment(
    enrollmentId: string,
    userId: string,
    userRole: string,
    query: { status?: string; priority?: string },
  ) {
    const enrollment = await this.prisma.rpm_enrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) {
      throw new NotFoundException('Inscripci\u00f3n no encontrada');
    }
    if (userRole === 'PATIENT' && enrollment.patient_id !== userId) {
      throw new ForbiddenException('Acceso denegado');
    }
    if (userRole === 'DOCTOR' && enrollment.assigned_physician_id !== userId) {
      throw new ForbiddenException('Acceso denegado');
    }

    const where: any = { enrollment_id: enrollmentId };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;

    const items = await this.prisma.rpm_alert.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        enrollment_id: true,
        type: true,
        priority: true,
        status: true,
        message: true,
        vital_id: true,
        acknowledged_by: true,
        acknowledged_at: true,
        created_at: true,
      },
    });

    return { items };
  }

  async acknowledgeAlert(alertId: string, userId: string) {
    const alert = await this.prisma.rpm_alert.findUnique({
      where: { id: alertId },
      include: { enrollment: true },
    });
    if (!alert) {
      throw new NotFoundException('Alerta no encontrada');
    }
    if (alert.enrollment.assigned_physician_id !== userId) {
      throw new ForbiddenException('Acceso denegado');
    }

    const updated = await this.prisma.rpm_alert.update({
      where: { id: alertId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledged_by: userId,
        acknowledged_at: new Date(),
      },
    });

    this.logger.log(`Alerta ${alertId} reconocida por ${userId}`);

    return {
      id: updated.id,
      status: updated.status,
      acknowledged_by: updated.acknowledged_by,
      acknowledged_at: updated.acknowledged_at,
    };
  }
}
