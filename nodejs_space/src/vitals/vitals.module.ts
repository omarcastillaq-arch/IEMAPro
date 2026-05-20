import { Module } from '@nestjs/common';
import { VitalsController } from './vitals.controller';
import { VitalsService } from './vitals.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [VitalsController],
  providers: [VitalsService, PrismaService],
})
export class VitalsModule {}
