import { Module } from '@nestjs/common';
import { MonitorController } from './monitor.controller';
import { MonitorRepository } from './monitor.repository';
import { MonitorService } from './monitor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [PrismaModule],
  providers: [MonitorRepository, MonitorService, AnalyticsService],
  controllers: [MonitorController, AbortController],
  exports: [MonitorService],
})
export class MonitorModule {}
