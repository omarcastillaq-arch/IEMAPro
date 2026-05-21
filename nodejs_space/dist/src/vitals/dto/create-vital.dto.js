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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateVitalDto = exports.VitalType = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var VitalType;
(function (VitalType) {
    VitalType["BLOOD_PRESSURE"] = "BLOOD_PRESSURE";
    VitalType["HEART_RATE"] = "HEART_RATE";
    VitalType["GLUCOSE"] = "GLUCOSE";
})(VitalType || (exports.VitalType = VitalType = {}));
class CreateVitalDto {
    vital_type;
    value;
    value2;
    recorded_at;
}
exports.CreateVitalDto = CreateVitalDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: VitalType, example: 'HEART_RATE' }),
    (0, class_validator_1.IsEnum)(VitalType, { message: 'Tipo de vital inv\u00e1lido' }),
    __metadata("design:type", String)
], CreateVitalDto.prototype, "vital_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 85 }),
    (0, class_validator_1.IsNumber)({}, { message: 'El valor debe ser un n\u00famero' }),
    __metadata("design:type", Number)
], CreateVitalDto.prototype, "value", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 80, description: 'Diast\u00f3lica para presi\u00f3n arterial' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateVitalDto.prototype, "value2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2025-05-18T10:00:00Z' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateVitalDto.prototype, "recorded_at", void 0);
//# sourceMappingURL=create-vital.dto.js.map