import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('El correo electrónico ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Find default organization (first active one)
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

    // Create patient profile
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

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
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

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('No autorizado');
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

  private generateToken(user: any): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
    });
  }
}
