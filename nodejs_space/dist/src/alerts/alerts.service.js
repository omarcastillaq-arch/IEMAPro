"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AlertsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let AlertsService = AlertsService_1 = class AlertsService {
    prisma;
    logger = new common_1.Logger(AlertsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAlertsByEnrollment(enrollmentId, userId, userRole, query) {
        const enrollment = await this.prisma.rpm_enrollment.findUnique({
            where: { id: enrollmentId },
        });
        if (!enrollment) {
            throw new common_1.NotFoundException('Inscripci\u00f3n no encontrada');
        }
        if (userRole === 'PATIENT' && enrollment.patient_id !== userId) {
            throw new common_1.ForbiddenException('Acceso denegado');
        }
        if (userRole === 'DOCTOR' && enrollment.assigned_physician_id !== userId) {
            throw new common_1.ForbiddenException('Acceso denegado');
        }
        const where = { enrollment_id: enrollmentId };
        if (query.status)
            where.status = query.status;
        if (query.priority)
            where.priority = query.priority;
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
    async acknowledgeAlert(alertId, userId) {
        const alert = await this.prisma.rpm_alert.findUnique({
            where: { id: alertId },
            include: { enrollment: true },
        });
        if (!alert) {
            throw new common_1.NotFoundException('Alerta no encontrada');
        }
        if (alert.enrollment.assigned_physician_id !== userId) {
            throw new common_1.ForbiddenException('Acceso denegado');
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
};
exports.AlertsService = AlertsService;
exports.AlertsService = AlertsService = AlertsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AlertsService);
//# sourceMappingURL=alerts.service.js.map