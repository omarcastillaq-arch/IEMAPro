import { IsString, IsNumber, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum VitalType {
  BLOOD_PRESSURE = 'BLOOD_PRESSURE',
  HEART_RATE = 'HEART_RATE',
  GLUCOSE = 'GLUCOSE',
}

export class CreateVitalDto {
  @ApiProperty({ enum: VitalType, example: 'HEART_RATE' })
  @IsEnum(VitalType, { message: 'Tipo de vital inv\u00e1lido' })
  vital_type: VitalType;

  @ApiProperty({ example: 85 })
  @IsNumber({}, { message: 'El valor debe ser un n\u00famero' })
  value: number;

  @ApiPropertyOptional({ example: 80, description: 'Diast\u00f3lica para presi\u00f3n arterial' })
  @IsOptional()
  @IsNumber()
  value2?: number;

  @ApiPropertyOptional({ example: '2025-05-18T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  recorded_at?: string;
}
