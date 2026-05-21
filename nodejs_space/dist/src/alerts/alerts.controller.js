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
exports.AlertsController = void 0;
const common_1 = require("@nestjs/common");
const alerts_service_1 = require("./alerts.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const swagger_1 = require("@nestjs/swagger");
let AlertsController = class AlertsController {
    alertsService;
    constructor(alertsService) {
        this.alertsService = alertsService;
    }
    async getAlerts(enrollmentId, req, status, priority) {
        return this.alertsService.getAlertsByEnrollment(enrollmentId, req.user.id, req.user.role, { status, priority });
    }
    async acknowledgeAlert(alertId, req) {
        return this.alertsService.acknowledgeAlert(alertId, req.user.id);
    }
};
exports.AlertsController = AlertsController;
__decorate([
    (0, common_1.Get)(':enrollmentId'),
    (0, roles_decorator_1.Roles)('PATIENT', 'DOCTOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener alertas por inscripci\u00f3n' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'priority', required: false }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lista de alertas' }),
    __param(0, (0, common_1.Param)('enrollmentId')),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('priority')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", Promise)
], AlertsController.prototype, "getAlerts", null);
__decorate([
    (0, common_1.Put)(':alertId/acknowledge'),
    (0, roles_decorator_1.Roles)('DOCTOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Reconocer alerta' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Alerta reconocida' }),
    __param(0, (0, common_1.Param)('alertId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AlertsController.prototype, "acknowledgeAlert", null);
exports.AlertsController = AlertsController = __decorate([
    (0, swagger_1.ApiTags)('Alertas'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('alerts'),
    __metadata("design:paramtypes", [alerts_service_1.AlertsService])
], AlertsController);
//# sourceMappingURL=alerts.controller.js.map