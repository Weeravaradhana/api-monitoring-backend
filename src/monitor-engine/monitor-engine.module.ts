import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { MonitorEngineScheduler } from './monitor-engine.scheduler';
import { MonitorEngineExecutor } from './monitor-engine.executor';

@Module({
  imports: [
    HttpModule.register({
      maxRedirects: 5,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
  ],
  providers: [MonitorEngineScheduler, MonitorEngineExecutor],
})
export class MonitorEngineModule {}
