import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('Doctor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
@Controller('doctor')
export class DoctorController {
  constructor(private doctorService: DoctorService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard del doctor' })
  @ApiResponse({ status: 200, description: 'Datos del dashboard' })
  async getDashboard(@Request() req: any) {
    return this.doctorService.getDashboard(req.user.id);
  }

  @Get('patients')
  @ApiOperation({ summary: 'Lista de pacientes asignados' })
  @ApiResponse({ status: 200, description: 'Lista de pacientes' })
  async getPatients(@Request() req: any) {
    return this.doctorService.getPatients(req.user.id);
  }

  @Get('patients/:enrollmentId')
  @ApiOperation({ summary: 'Detalle de paciente' })
  @ApiResponse({ status: 200, description: 'Detalle del paciente' })
  async getPatientDetail(@Param('enrollmentId') enrollmentId: string, @Request() req: any) {
    return this.doctorService.getPatientDetail(enrollmentId, req.user.id);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Alertas de todos los pacientes del doctor' })
  @ApiQuery({ name: 'priority', required: false, description: 'CRITICAL o WARNING' })
  @ApiQuery({ name: 'status', required: false, description: 'NEW o ACKNOWLEDGED' })
  @ApiResponse({ status: 200, description: 'Lista de alertas' })
  async getAlerts(
    @Request() req: any,
    @Query('priority') priority?: string,
    @Query('status') status?: string,
  ) {
    return this.doctorService.getAlerts(req.user.id, { priority, status });
  }
}
