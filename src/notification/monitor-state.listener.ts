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
      `Received 'monitor.down' event for Monitor ID: ${payload.monitorId}. Processing alert...`,
    );

    const monitor = await this.prisma.monitor.findUnique({
      where: { id: payload.monitorId },
      include: {
        tenant: {
          include: {
            users: true,
            webhooks: { where: { isActive: true } },
            slackConfig: true,
          },
        },
      },
    });

    if (!monitor || !monitor.tenant || !monitor.tenant.users.length) return;

    const now = new Date();

    const activeUsers = monitor.tenant.users.filter(
      (user) => !user.alertsMutedUntil || user.alertsMutedUntil <= now,
    );

    if (activeUsers.length === 0) {
      this.logger.warn(
        `[ALERT MUTED] All users in Tenant ${monitor.tenantId} have suppressed alerts. Skipping notification dispatch.`,
      );
      return;
    }

    const COOL_DOWN_MINUTES = 15;
    if (monitor.lastNotificationaAt) {
      const timeSinceLastAlert =
        (now.getTime() - monitor.lastNotificationaAt.getTime()) / 1000 / 60;
      if (timeSinceLastAlert < COOL_DOWN_MINUTES) {
        this.logger.warn(
          `[ALERT THROTTLED] Anti-Spam active. Last alert was ${Math.round(timeSinceLastAlert)}m ago. Skipping.`,
        );
        return;
      }
    }

    const promises: Promise<any>[] = [];
    const channelsExecuted: string[] = [];

    const targetEmails = monitor.tenant.users.map((e) => e.email);
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

    const webhookPayload = {
      event: 'monitor.down',
      monitorId: payload.monitorId,
      monitorName: payload.name,
      url: payload.url,
      statusCode: payload.statusCode,
      errorMessage: payload.errorMessage || 'Network Error',
      timestamp: now.toISOString(),
    };

    monitor.tenant.webhooks.forEach((webhook) => {
      channelsExecuted.push(`WEBHOOK (${webhook.url})`);
      promises.push(
        this.webhookService.dispatchWebhook(
          webhook.url,
          webhook.secretToken,
          webhookPayload,
        ),
      );
    });

    if (monitor.tenant.slackConfig && monitor.tenant.slackConfig.isActive) {
      channelsExecuted.push(
        `SLACK (${monitor.tenant.slackConfig.channelName || 'Webhook'})`,
      );
      promises.push(
        this.slackService.sendSlackAlert(
          monitor.tenant.slackConfig.webhookUrl,
          'DOWN',
          payload.url,
          payload.errorMessage ||
            `HTTP Status Code: ${payload.statusCode || 'N/A'}`,
        ),
      );
    }

    const results = await Promise.allSettled(promises);
    let emailSuccess = true;

    results.forEach((res, index) => {
      if (res.status === 'rejected') {
        this.logger.error(
          `Notification Channel [${channelsExecuted[index]}] failed to dispatch:`,
          res.reason,
        );
        if (channelsExecuted[index].startsWith('EMAIL')) {
          emailSuccess = false;
        }
      }
    });
    await this.prisma.$transaction([
      this.prisma.monitor.update({
        where: { id: payload.monitorId },
        data: { lastNotificationaAt: now },
      }),
      this.prisma.notificationLog.create({
        data: {
          monitorId: payload.monitorId,
          stateSent: 'DOWN',
          sentTo: `Channels: [${channelsExecuted.join(' | ')}]`,
          success: emailSuccess,
          errorMessage: emailSuccess
            ? null
            : 'Multi-channel dispatch completed with errors. See logs.',
        },
      }),
    ]);
  }

  @OnEvent('monitor.up', { async: true })
  async handleMonitorUpEvent(
    payload: monitorEventPayloadInterface.MonitorEventPayload,
  ) {
    this.logger.log(
      `Received 'monitor.up' event for [${payload.name}]. Dispatching recovery alert...`,
    );

    const monitor = await this.prisma.monitor.findUnique({
      where: { id: payload.monitorId },
      include: {
        tenant: {
          include: {
            users: true,
            webhooks: { where: { isActive: true } },
            slackConfig: true,
          },
        },
      },
    });

    if (!monitor || !monitor.tenant || !monitor.tenant.users.length) return;

    const now = new Date();
    const activeUsers = monitor.tenant.users.filter(
      (user) => !user.alertsMutedUntil || user.alertsMutedUntil <= now,
    );

    if (activeUsers.length === 0) {
      this.logger.warn(
        `[ALERT MUTED] Workspace alerts are muted. Skipping recovery email.`,
      );
      return;
    }

    const promises: Promise<any>[] = [];
    const channelsExecuted: string[] = [];

    const targetEmails = activeUsers.map((e) => e.email);
    if (targetEmails.length > 0) {
      channelsExecuted.push(`EMAIL (${targetEmails.length})`);
      promises.push(
        this.notificationService.sendRecoveryAlert(targetEmails, payload.url),
      );
    }

    const webhookPayload = {
      event: 'monitor.up',
      monitorId: payload.monitorId,
      monitorName: payload.name,
      url: payload.url,
      timestamp: now.toISOString(),
    };

    monitor.tenant.webhooks.forEach((webhook) => {
      channelsExecuted.push(`WEBHOOK (${webhook.url})`);
      promises.push(
        this.webhookService.dispatchWebhook(
          webhook.url,
          webhook.secretToken,
          webhookPayload,
        ),
      );
    });

    if (monitor.tenant.slackConfig && monitor.tenant.slackConfig.isActive) {
      channelsExecuted.push(
        `SLACK (${monitor.tenant.slackConfig.channelName || 'Webhook'})`,
      );
      promises.push(
        this.slackService.sendSlackAlert(
          monitor.tenant.slackConfig.webhookUrl,
          'UP',
          payload.url,
          'Service has recovered and is now stable.',
        ),
      );
    }

    const results = await Promise.allSettled(promises);
    let emailSuccess = true;

    results.forEach((res, index) => {
      if (res.status === 'rejected') {
        this.logger.error(
          `Notification Channel [${channelsExecuted[index]}] failed to dispatch recovery alert:`,
          res.reason,
        );
        if (channelsExecuted[index].startsWith('EMAIL')) {
          emailSuccess = false;
        }
      }
    });

    await this.prisma.$transaction([
      this.prisma.monitor.update({
        where: { id: payload.monitorId },
        data: { lastNotificationaAt: null },
      }),
      this.prisma.notificationLog.create({
        data: {
          monitorId: payload.monitorId,
          stateSent: 'UP',
          sentTo: `Channels: [${channelsExecuted.join(' | ')}]`,
          success: emailSuccess,
          errorMessage: emailSuccess
            ? null
            : 'Multi-channel recovery dispatch had errors.',
        },
      }),
    ]);
  }
}
