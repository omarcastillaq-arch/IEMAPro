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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoctorController = void 0;
const common_1 = require("@nestjs/common");
const doctor_service_1 = require("./doctor.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const swagger_1 = require("@nestjs/swagger");
let DoctorController = class DoctorController {
    doctorService;
    constructor(doctorService) {
        this.doctorService = doctorService;
    }
    async getDashboard(req) {
        return this.doctorService.getDashboard(req.user.id);
    }
    async getPatients(req) {
        return this.doctorService.getPatients(req.user.id);
    }
    async getPatientDetail(enrollmentId, req) {
        return this.doctorService.getPatientDetail(enrollmentId, req.user.id);
    }
    async getAlerts(req, priority, status) {
        return this.doctorService.getAlerts(req.user.id, { priority, status });
    }
};
exports.DoctorController = DoctorController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, swagger_1.ApiOperation)({ summary: 'Dashboard del doctor' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Datos del dashboard' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DoctorController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('patients'),
    (0, swagger_1.ApiOperation)({ summary: 'Lista de pacientes asignados' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lista de pacientes' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DoctorController.prototype, "getPatients", null);
__decorate([
    (0, common_1.Get)('patients/:enrollmentId'),
    (0, swagger_1.ApiOperation)({ summary: 'Detalle de paciente' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Detalle del paciente' }),
    __param(0, (0, common_1.Param)('enrollmentId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DoctorController.prototype, "getPatientDetail", null);
__decorate([
    (0, common_1.Get)('alerts'),
    (0, swagger_1.ApiOperation)({ summary: 'Alertas de todos los pacientes del doctor' }),
    (0, swagger_1.ApiQuery)({ name: 'priority', required: false, description: 'CRITICAL o WARNING' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, description: 'NEW o ACKNOWLEDGED' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lista de alertas' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('priority')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], DoctorController.prototype, "getAlerts", null);
exports.DoctorController = DoctorController = __decorate([
    (0, swagger_1.ApiTags)('Doctor'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('DOCTOR'),
    (0, common_1.Controller)('doctor'),
    __metadata("design:paramtypes", [doctor_service_1.DoctorService])
], DoctorController);
//# sourceMappingURL=doctor.controller.js.map