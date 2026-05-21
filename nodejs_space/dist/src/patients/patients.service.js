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
var PatientsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let PatientsService = PatientsService_1 = class PatientsService {
    prisma;
    logger = new common_1.Logger(PatientsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getProfile(userId) {
        const profile = await this.prisma.patient_profile.findUnique({
            where: { user_id: userId },
            include: { user: { select: { name: true, email: true } } },
        });
        if (!profile) {
            throw new common_1.NotFoundException('Perfil de paciente no encontrado');
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
    async getDashboard(userId) {
        const enrollment = await this.prisma.rpm_enrollment.findFirst({
            where: { patient_id: userId, status: 'active' },
        });
        if (!enrollment) {
            throw new common_1.NotFoundException('No se encontr\u00f3 inscripci\u00f3n activa');
        }
        const vitalTypes = ['BLOOD_PRESSURE', 'HEART_RATE', 'GLUCOSE'];
        const lastVitals = {};
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
};
exports.PatientsService = PatientsService;
exports.PatientsService = PatientsService = PatientsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PatientsService);
//# sourceMappingURL=patients.service.js.map