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
      include: {
        tenant: { include: { members: { include: { user: true } } } },
      },
    });

    if (!monitor || !monitor.tenant.members.length) return;

    const now = new Date();

    const COOL_DOWN_MINUTES = 15;
    if (monitor.lastNotificationAt) {
      const timeSinceLastAlert =
        (now.getTime() - monitor.lastNotificationAt.getTime()) / 1000 / 60;
      if (timeSinceLastAlert < COOL_DOWN_MINUTES) {
        this.logger.warn(
          `[ALERT THROTTLED] Anti-Spam active. Last alert was ${Math.round(timeSinceLastAlert)}m ago. Skipping.`,
        );
        return;
      }
    }

    const activeUsers = monitor.tenant.members
      .map((m) => m.user)
      .filter(
        (u): u is typeof u & { email: string } =>
          !!u && (!u.alertsMutedUntil || u.alertsMutedUntil <= now),
      );

    if (activeUsers.length === 0) {
      this.logger.warn(
        `[ALERT MUTED] All users in this workspace have muted alerts. Skipping email.`,
      );
      return;
    }

    const targetEmails = activeUsers.map((u) => u.email);

    const isSuccess = await this.notificationService.sendFailureAlert(
      targetEmails,
      payload.url,
      payload.statusCode,
      payload.errorMessage,
    );

    await this.prisma.$transaction([
      this.prisma.monitor.update({
        where: { id: payload.monitorId },
        data: { lastNotificationAt: now },
      }),
      this.prisma.notificationLog.create({
        data: {
          monitorId: payload.monitorId,
          stateSent: 'DOWN',
          sentTo: targetEmails.join(', '),
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
      include: {
        tenant: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!monitor || !monitor.tenant || !monitor.tenant.members.length) return;

    const now = new Date();
    const activeUsers = monitor.tenant.members
      .map((m) => m.user)
      .filter(
        (u): u is typeof u & { email: string } =>
          !!u && (!u.alertsMutedUntil || u.alertsMutedUntil <= now),
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
        data: { lastNotificationAt: null },
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
