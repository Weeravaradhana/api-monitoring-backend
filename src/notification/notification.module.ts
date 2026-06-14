import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { MonitorStateListener } from './monitor-state.listener';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [NotificationService, MonitorStateListener, PrismaService],
  exports: [NotificationService],
})
export class NotificationModule {}
