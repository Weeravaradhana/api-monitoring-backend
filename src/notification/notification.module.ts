import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { MonitorStateListener } from './monitor-state.listener';

@Module({
  providers: [NotificationService, MonitorStateListener],
  exports: [NotificationService],
})
export class NotificationModule {}
