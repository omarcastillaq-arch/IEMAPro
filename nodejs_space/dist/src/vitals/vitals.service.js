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
var VitalsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VitalsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const UNIT_MAP = {
    BLOOD_PRESSURE: 'mmHg',
    HEART_RATE: 'bpm',
    GLUCOSE: 'mg/dL',
};
let VitalsService = VitalsService_1 = class VitalsService {
    prisma;
    logger = new common_1.Logger(VitalsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createVital(userId, dto) {
        const enrollment = await this.prisma.rpm_enrollment.findFirst({
            where: { patient_id: userId, status: 'active' },
        });
        if (!enrollment) {
            throw new common_1.NotFoundException('No se encontr\u00f3 inscripci\u00f3n activa');
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
        const createdAlerts = [];
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
    async getVitals(enrollmentId, userId, userRole, query) {
        await this.verifyEnrollmentAccess(enrollmentId, userId, userRole);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const where = { enrollment_id: enrollmentId };
        if (query.type)
            where.vital_type = query.type;
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
    async verifyEnrollmentAccess(enrollmentId, userId, role) {
        const enrollment = await this.prisma.rpm_enrollment.findUnique({
            where: { id: enrollmentId },
        });
        if (!enrollment) {
            throw new common_1.NotFoundException('Inscripci\u00f3n no encontrada');
        }
        if (role === 'PATIENT' && enrollment.patient_id !== userId) {
            throw new common_1.ForbiddenException('Acceso denegado');
        }
        if (role === 'DOCTOR' && enrollment.assigned_physician_id !== userId) {
            throw new common_1.ForbiddenException('Acceso denegado');
        }
        return enrollment;
    }
    checkThresholds(enrollment, dto) {
        const alerts = [];
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
};
exports.VitalsService = VitalsService;
exports.VitalsService = VitalsService = VitalsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], VitalsService);
//# sourceMappingURL=vitals.service.js.map