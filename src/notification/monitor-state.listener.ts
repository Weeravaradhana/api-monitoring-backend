import { Injectable, Logger } from '@nestjs/common';
import { MonitorEngineExecutor } from '../monitor-engine/monitor-engine.executor';
import { NotificationService } from './notification.service';
import { OnEvent } from '@nestjs/event-emitter';
import * as monitorEventPayloadInterface from '../interface/monitor.event.payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookNotificationService } from './webhook-notification.service';
import { SlackNotificationService } from './slack-notification.service';

@Injectable()
export class MonitorStateListener {
  private readonly logger = new Logger(MonitorEngineExecutor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
    private readonly webhookService: WebhookNotificationService,
    private readonly slackService: SlackNotificationService,
  ) {}

  @OnEvent('monitor.down', { async: true })
  async handleMonitorDownEvent(
    payload: monitorEventPayloadInterface.MonitorEventPayload,
  ) {
    this.logger.log(
      `Processing 'monitor.down' for Monitor ID: ${payload.monitorId}.`,
    );

    const monitor = await this.prisma.monitor.findUnique({
      where: { id: payload.monitorId },
      include: {
        tenant: {
          include: {
            members: { include: { user: true } },
            webhookConfigs: { where: { isActive: true } },
            slackConfig: true,
          },
        },
      },
    });

    if (!monitor || !monitor.tenant.members.length) return;

    const now = new Date();

    if (monitor.lastNotificationAt) {
      const timeSinceLastAlert =
        (now.getTime() - monitor.lastNotificationAt.getTime()) / 1000 / 60;
      if (timeSinceLastAlert < 15) return;
    }

    const activeUsers = monitor.tenant.members
      .map((m) => m.user)
      .filter((u) => !!u && (!u.alertsMutedUntil || u.alertsMutedUntil <= now));

    if (activeUsers.length === 0) return;

    const targetEmails = activeUsers.map((u) => u.email);
    const promises: Promise<any>[] = [];
    const channelsExecuted: string[] = [];

    // Email Dispatch
    if (targetEmails.length > 0) {
      channelsExecuted.push(`EMAIL (${targetEmails.length})`);
      promises.push(
        this.notificationService.sendFailureAlert(
          targetEmails,
          payload.url,
          payload.statusCode,
          payload.errorMessage,
        ),
      );
    }

    // Webhook Dispatch
    const webhookPayload = {
      event: 'monitor.down',
      monitorId: payload.monitorId,
      monitorName: payload.name,
      url: payload.url,
      statusCode: payload.statusCode,
      errorMessage: payload.errorMessage || 'Network Error',
      timestamp: now.toISOString(),
    };

    monitor.tenant.webhookConfigs.forEach((webhook) => {
      channelsExecuted.push(`WEBHOOK (${webhook.url})`);
      promises.push(
        this.webhookService.dispatchWebhook(
          webhook.url,
          webhook.secretToken,
          webhookPayload,
        ),
      );
    });

    // Slack Dispatch
    if (monitor.tenant.slackConfig?.isActive) {
      channelsExecuted.push(
        `SLACK (${monitor.tenant.slackConfig.channelName || 'Channel'})`,
      );
      promises.push(
        this.slackService.sendSlackAlert(
          monitor.tenant.slackConfig.webhookUrl,
          'DOWN',
          payload.url,
          payload.errorMessage || `Status: ${payload.statusCode || 'N/A'}`,
        ),
      );
    }

    const results = await Promise.allSettled(promises);
    let success = true;
    results.forEach((res) => {
      if (res.status === 'rejected') success = false;
    });

    await this.prisma.$transaction([
      this.prisma.monitor.update({
        where: { id: payload.monitorId },
        data: { lastNotificationAt: now },
      }),
      this.prisma.notificationLog.create({
        data: {
          monitorId: payload.monitorId,
          stateSent: 'DOWN',
          sentTo: `Channels: [${channelsExecuted.join(' | ')}]`,
          success,
          errorMessage: success ? null : 'Some channels failed.',
        },
      }),
    ]);
  }

  @OnEvent('monitor.up', { async: true })
  async handleMonitorUpEvent(
    payload: monitorEventPayloadInterface.MonitorEventPayload,
  ) {
    this.logger.log(`Processing 'monitor.up' for [${payload.name}].`);

    const monitor = await this.prisma.monitor.findUnique({
      where: { id: payload.monitorId },
      include: {
        tenant: {
          include: {
            members: { include: { user: true } },
            webhookConfigs: { where: { isActive: true } },
            slackConfig: true,
          },
        },
      },
    });

    if (!monitor || !monitor.tenant.members.length) return;

    const targetEmails = monitor.tenant.members.map((m) => m.user.email);
    const promises: Promise<any>[] = [];

    promises.push(
      this.notificationService.sendRecoveryAlert(targetEmails, payload.url),
    );

    await Promise.allSettled(promises);
    await this.prisma.monitor.update({
      where: { id: payload.monitorId },
      data: { lastNotificationAt: null },
    });
  }
}
