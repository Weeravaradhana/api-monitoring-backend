import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { MonitorModule } from './monitor/monitor.module';
import { MonitorEngineModule } from './monitor-engine/monitor-engine.module';

@Module({
  imports: [PrismaModule, MonitorModule, MonitorEngineModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
