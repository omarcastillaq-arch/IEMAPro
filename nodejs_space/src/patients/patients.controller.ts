import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Pacientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Get('profile')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Obtener perfil del paciente' })
  @ApiResponse({ status: 200, description: 'Perfil del paciente' })
  async getProfile(@Request() req: any) {
    return this.patientsService.getProfile(req.user.id);
  }

  @Get('dashboard')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Dashboard del paciente' })
  @ApiResponse({ status: 200, description: 'Datos del dashboard' })
  async getDashboard(@Request() req: any) {
    return this.patientsService.getDashboard(req.user.id);
  }
}
