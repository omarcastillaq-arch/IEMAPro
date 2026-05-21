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
exports.VitalsController = void 0;
const common_1 = require("@nestjs/common");
const vitals_service_1 = require("./vitals.service");
const create_vital_dto_1 = require("./dto/create-vital.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const swagger_1 = require("@nestjs/swagger");
let VitalsController = class VitalsController {
    vitalsService;
    constructor(vitalsService) {
        this.vitalsService = vitalsService;
    }
    async createVital(req, dto) {
        return this.vitalsService.createVital(req.user.id, dto);
    }
    async getVitals(enrollmentId, req, type, page, limit) {
        return this.vitalsService.getVitals(enrollmentId, req.user.id, req.user.role, {
            type,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }
};
exports.VitalsController = VitalsController;
__decorate([
    (0, common_1.Post)('vitals'),
    (0, roles_decorator_1.Roles)('PATIENT'),
    (0, swagger_1.ApiOperation)({ summary: 'Registrar lectura de vital' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Vital registrado' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_vital_dto_1.CreateVitalDto]),
    __metadata("design:returntype", Promise)
], VitalsController.prototype, "createVital", null);
__decorate([
    (0, common_1.Get)('vitals/:enrollmentId'),
    (0, roles_decorator_1.Roles)('PATIENT', 'DOCTOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Historial de vitales por inscripci\u00f3n' }),
    (0, swagger_1.ApiQuery)({ name: 'type', required: false, description: 'Filtrar por tipo de vital' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lista de vitales' }),
    __param(0, (0, common_1.Param)('enrollmentId')),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Query)('type')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], VitalsController.prototype, "getVitals", null);
exports.VitalsController = VitalsController = __decorate([
    (0, swagger_1.ApiTags)('Vitales'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [vitals_service_1.VitalsService])
], VitalsController);
//# sourceMappingURL=vitals.controller.js.map