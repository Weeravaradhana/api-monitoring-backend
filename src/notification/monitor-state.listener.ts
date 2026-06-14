import { Injectable, Logger } from '@nestjs/common';
import { MonitorEngineExecutor } from '../monitor-engine/monitor-engine.executor';
import { NotificationService } from './notification.service';
import { OnEvent } from '@nestjs/event-emitter';
import * as monitorEventPayloadInterface from '../interface/monitor.event.payload.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MonitorStateListener {
  private readonly logger = new Logger(MonitorEngineExecutor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
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
      include: { tenant: { include: { users: true } } },
    });

    if (!monitor || !monitor.tenant.users) return;

    const now = new Date();

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

    const targetEmail = monitor.tenant.users.map((e) => e.email);

    const isSuccess = await this.notificationService.sendFailureAlert(
      targetEmail,
      payload.url,
      payload.statusCode,
      payload.errorMessage,
    );

    await this.prisma.$transaction([
      this.prisma.monitor.update({
        where: { id: payload.monitorId },
        data: { lastNotificationaAt: now },
      }),
      this.prisma.notificationLog.create({
        data: {
          monitorId: payload.monitorId,
          stateSent: 'DOWN',
          sentTo: targetEmail.join(', '),
          success: isSuccess,
          errorMessage: isSuccess ? null : 'SMTP Dispatch Failure',
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
      include: { tenant: { include: { users: true } } },
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

    const targetEmails = activeUsers.map((e) => e.email);

    const isSuccess = await this.notificationService.sendRecoveryAlert(
      targetEmails,
      payload.url,
    );

    await this.prisma.$transaction([
      this.prisma.monitor.update({
        where: { id: payload.monitorId },
        data: { lastNotificationaAt: null },
      }),
      this.prisma.notificationLog.create({
        data: {
          monitorId: payload.monitorId,
          stateSent: 'UP',
          sentTo: targetEmails.join(', '),
          success: isSuccess,
          errorMessage: isSuccess ? null : 'SMTP Dispatch Failure',
        },
      }),
    ]);
  }
}
