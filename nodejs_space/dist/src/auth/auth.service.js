"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../common/prisma.service");
const bcrypt = __importStar(require("bcrypt"));
let AuthService = AuthService_1 = class AuthService {
    prisma;
    jwtService;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async signup(dto) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) {
            throw new common_1.BadRequestException('El correo electrónico ya está registrado');
        }
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const defaultOrg = await this.prisma.organization.findFirst({ where: { is_active: true } });
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                name: dto.name,
                password: hashedPassword,
                role: 'PATIENT',
                organization_id: defaultOrg?.id ?? null,
            },
        });
        if (defaultOrg) {
            await this.prisma.patient_profile.create({
                data: {
                    user_id: user.id,
                    organization_id: defaultOrg.id,
                },
            });
        }
        const token = this.generateToken(user);
        this.logger.log(`Nuevo usuario registrado: ${user.email}`);
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                organization_id: user.organization_id,
            },
        };
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        const isValid = await bcrypt.compare(dto.password, user.password);
        if (!isValid) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        const token = this.generateToken(user);
        this.logger.log(`Login exitoso: ${user.email}`);
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                organization_id: user.organization_id,
            },
        };
    }
    async getMe(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new common_1.UnauthorizedException('No autorizado');
        }
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                organization_id: user.organization_id,
            },
        };
    }
    generateToken(user) {
        return this.jwtService.sign({
            sub: user.id,
            email: user.email,
            role: user.role,
            organization_id: user.organization_id,
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map