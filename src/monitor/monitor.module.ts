import { Module } from '@nestjs/common';
import { MonitorController } from './monitor.controller';
import { MonitorRepository } from './monitor.repository';
import { MonitorService } from './monitor.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MonitorRepository, MonitorService],
  controllers: [MonitorController],
  exports: [MonitorService],
})
export class MonitorModule {}
