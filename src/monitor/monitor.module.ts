import { Module } from '@nestjs/common';
import { MonitorController } from './monitor.controller';
import { MonitorRepository } from './monitor.repository';
import { MonitorService } from './monitor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsService } from './analytics.service';
import { RedisModule } from '../redis/redis.module';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [MonitorRepository, MonitorService, AnalyticsService],
  controllers: [MonitorController, AnalyticsController],
  exports: [MonitorService],
})
export class MonitorModule {}
