import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import axios, { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';

export type MonitorWithTenant = Prisma.MonitorGetPayload<{
  include: {
    tenant: {
      include: {
        members: {
          include: {
            user: true;
          };
        };
      };
    };
  };
}>;

@Injectable()
export class MonitorEngineExecutor {
  private readonly logger = new Logger(MonitorEngineExecutor.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async executeJob(monitor: MonitorWithTenant) {
    const controller = new AbortController();

    const timeOutId = setTimeout(
      () => controller.abort(),
      monitor.timeout * 1000,
    );

    const startTime = process.hrtime.bigint();

    let statusCode: number | null = null;
    let success = false;
    let errorMessage: string | null = null;

    try {
      const config: AxiosRequestConfig = {
        method: monitor.method,
        url: monitor.url,
        headers: monitor.headers as Record<string, string>,
        data: monitor.body
          ? (JSON.parse(monitor.body) as Record<string, unknown>)
          : undefined,
        signal: controller.signal,
        validateStatus: () => true,
      };
      const response = await firstValueFrom(this.httpService.request(config));
      statusCode = response.status;
      success = statusCode >= 200 && statusCode < 400;
    } catch (error: unknown) {
      success = false;
      if (axios.isCancel(error) || (error as Error).name === 'AbortError') {
        statusCode = 408;
        errorMessage = 'Request Timeout';
      } else if (axios.isAxiosError(error)) {
        statusCode = error.response?.status || null;
        errorMessage = error.message || 'Axios Network Error';
      } else {
        statusCode = null;
        errorMessage = (error as Error).message || 'Unknown System Error';
      }
    } finally {
      clearTimeout(timeOutId);
    }

    const endTime = process.hrtime.bigint();
    const responseTime = Number((endTime - startTime) / BigInt(1000000));

    const currentState = success ? 'UP' : 'DOWN';
    const previousState = monitor.lastState;

    const userEmails = monitor.tenant.members
      .map((m) => m.user?.email)
      .filter((email): email is string => !!email);
    await this.saveResultAndUpdateMonitor(
      monitor,
      statusCode,
      responseTime,
      success,
      errorMessage,
      currentState,
    );

    if (previousState !== currentState) {
      this.logger.warn(
        `[STATE TRANSITION] Monitor '${monitor.name}' changed from ${previousState} to ${currentState}!`,
      );
      const eventName = success ? 'monitor.up' : 'monitor.down';
      this.eventEmitter.emit(eventName, {
        monitorId: monitor.id,
        url: monitor.url,
        name: monitor.name,
        statusCode,
        errorMessage,
        userEmails,
        tenantId: monitor.tenantId,
      });
    } else if (currentState === 'DOWN') {
      this.eventEmitter.emit('monitor.down', {
        monitorId: monitor.id,
        url: monitor.url,
        name: monitor.name,
        statusCode,
        errorMessage,
        userEmails,
        tenantId: monitor.tenantId,
      });
    } else {
      this.logger.log(
        `[DEDUPLICATED] Monitor '${monitor.name}' remains ${currentState}. Alert suppressed.`,
      );
    }

    await this.saveResultAndUpdateMonitor(
      monitor,
      statusCode,
      responseTime,
      success,
      errorMessage,
      currentState,
    );
  }

  private async saveResultAndUpdateMonitor(
    monitor: MonitorWithTenant,
    statusCode: number | null,
    responseTime: number,
    success: boolean,
    errorMessage: string | null,
    currentState: string,
  ) {
    const now = new Date();
    const nextRunAt = new Date(now.getTime() + monitor.interval * 1000);

    const lastNotificationAtUpdate = success
      ? null
      : monitor.lastNotificationAt;

    const updateData: Prisma.MonitorUpdateInput = {
      nextRunAt,
      lastState: currentState,
      lastNotificationAt: lastNotificationAtUpdate,
    };

    if (success) {
      updateData.lastNotificationAt = null;
    }

    try {
      const [updatedMonitor] = await this.prisma.$transaction([
        this.prisma.monitoringResult.create({
          data: {
            monitorId: monitor.id,
            statusCode: statusCode,
            responseTime: responseTime,
            success: success,
            errorMessage: errorMessage,
            checkedAt: now,
          },
        }),
        this.prisma.monitor.update({
          where: { id: monitor.id },

          data: updateData,
        }),
      ]);

      return updatedMonitor;
    } catch (dbError) {
      this.logger.error(
        `Failed to save execution results for Monitor ${monitor.id}:`,
        dbError,
      );
    }
  }
}
