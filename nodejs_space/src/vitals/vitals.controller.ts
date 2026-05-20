import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { VitalsService } from './vitals.service';
import { CreateVitalDto } from './dto/create-vital.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('Vitales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class VitalsController {
  constructor(private vitalsService: VitalsService) {}

  @Post('vitals')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Registrar lectura de vital' })
  @ApiResponse({ status: 201, description: 'Vital registrado' })
  async createVital(@Request() req: any, @Body() dto: CreateVitalDto) {
    return this.vitalsService.createVital(req.user.id, dto);
  }

  @Get('vitals/:enrollmentId')
  @Roles('PATIENT', 'DOCTOR')
  @ApiOperation({ summary: 'Historial de vitales por inscripci\u00f3n' })
  @ApiQuery({ name: 'type', required: false, description: 'Filtrar por tipo de vital' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista de vitales' })
  async getVitals(
    @Param('enrollmentId') enrollmentId: string,
    @Request() req: any,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vitalsService.getVitals(enrollmentId, req.user.id, req.user.role, {
      type,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
