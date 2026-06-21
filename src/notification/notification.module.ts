import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { MonitorStateListener } from './monitor-state.listener';
import { PrismaService } from '../prisma/prisma.service'; // ඔයාගේ PrismaService path එක
import { WebhookNotificationService } from './webhook-notification.service';
import { SlackNotificationService } from './slack-notification.service';
import { NotificationConfigController } from './notification-configuration.controller';
import { NotificationConfigService } from './notification-configuration.service';

@Module({
  imports: [],
  controllers: [NotificationConfigController],
  providers: [
    NotificationService,
    MonitorStateListener,
    PrismaService,
    WebhookNotificationService,
    SlackNotificationService,
    NotificationConfigService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
