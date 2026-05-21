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
var DoctorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let DoctorService = DoctorService_1 = class DoctorService {
    prisma;
    logger = new common_1.Logger(DoctorService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboard(userId) {
        const enrollments = await this.prisma.rpm_enrollment.findMany({
            where: { assigned_physician_id: userId, status: 'active' },
        });
        const enrollmentIds = enrollments.map((e) => e.id);
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
            recentVitals: recentVitals.map((v) => ({
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
            recentAlerts: recentAlerts.map((a) => ({
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
    async getPatients(userId) {
        const enrollments = await this.prisma.rpm_enrollment.findMany({
            where: { assigned_physician_id: userId },
            orderBy: { patient_name: 'asc' },
        });
        return {
            patients: enrollments.map((e) => ({
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
    async getPatientDetail(enrollmentId, userId) {
        const enrollment = await this.prisma.rpm_enrollment.findUnique({
            where: { id: enrollmentId },
        });
        if (!enrollment) {
            throw new common_1.NotFoundException('Inscripción no encontrada');
        }
        if (enrollment.assigned_physician_id !== userId) {
            throw new common_1.ForbiddenException('Acceso denegado');
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
    async getAlerts(userId, query) {
        const enrollments = await this.prisma.rpm_enrollment.findMany({
            where: { assigned_physician_id: userId },
        });
        const enrollmentIds = enrollments.map((e) => e.id);
        const where = {
            enrollment_id: { in: enrollmentIds },
        };
        if (query.status) {
            where.status = query.status;
        }
        else {
            where.status = { in: ['NEW', 'ACKNOWLEDGED'] };
        }
        if (query.priority)
            where.priority = query.priority;
        const items = await this.prisma.rpm_alert.findMany({
            where,
            orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
            include: { enrollment: { select: { patient_name: true } } },
        });
        return {
            items: items.map((a) => ({
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
};
exports.DoctorService = DoctorService;
exports.DoctorService = DoctorService = DoctorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DoctorService);
//# sourceMappingURL=doctor.service.js.map