import { Controller, Get, Put, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('Alertas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get(':enrollmentId')
  @Roles('PATIENT', 'DOCTOR')
  @ApiOperation({ summary: 'Obtener alertas por inscripci\u00f3n' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiResponse({ status: 200, description: 'Lista de alertas' })
  async getAlerts(
    @Param('enrollmentId') enrollmentId: string,
    @Request() req: any,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.alertsService.getAlertsByEnrollment(enrollmentId, req.user.id, req.user.role, { status, priority });
  }

  @Put(':alertId/acknowledge')
  @Roles('DOCTOR')
  @ApiOperation({ summary: 'Reconocer alerta' })
  @ApiResponse({ status: 200, description: 'Alerta reconocida' })
  async acknowledgeAlert(@Param('alertId') alertId: string, @Request() req: any) {
    return this.alertsService.acknowledgeAlert(alertId, req.user.id);
  }
}
