import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';

export type MonitorWithUser = Prisma.MonitorGetPayload<{
  include: { user: true };
}>;

@Injectable()
export class MonitorEngineExecutor {
  private readonly logger = new Logger(MonitorEngineExecutor.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async executeJob(monitor: MonitorWithUser) {
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
      if (!success) {
        errorMessage = `HTTP Error Status: ${statusCode}`;
        this.eventEmitter.emit('monitor.down', {
          monitorId: monitor.id,
          url: monitor.url,
          statusCode,
          errorMessage,
        });
      }
    } catch (error: unknown) {
      success = false;
      if (axios.isAxiosError(error)) {
        if (axios.isCancel(error)) {
          const axiosError = error as AxiosError<any>;

          if (
            axiosError.code === 'ECONNABORTED' ||
            axiosError.message.includes('timeout')
          )
            statusCode = 408;
          errorMessage = 'Request Timeout';
        } else {
          const genericError = error as Error;
          statusCode = null;
          errorMessage = genericError.message || 'Unknow System Error';
        }
      }
    } finally {
      clearTimeout(timeOutId);
    }

    const endTime = process.hrtime.bigint();
    const responseTime = Number((endTime - startTime) / BigInt(1000000));

    const currentState = success ? 'UP' : 'DOWN';
    const previousState = monitor.lastState;

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
        userEmail: monitor.user.email,
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
    monitor: MonitorWithUser,
    statusCode: number | null,
    responseTime: number,
    success: boolean,
    errorMessage: string | null,
    currentState: string,
  ) {
    const now = new Date();
    const nextRunAt = new Date(now.getTime() + monitor.interval * 1000);

    try {
      await this.prisma.$transaction([
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
          data: {
            nextRunAt,
            lastState: currentState,
          },
        }),
      ]);
    } catch (dbError) {
      this.logger.error(
        `Failed to save execution results for Monitor ${monitor.id}:`,
        dbError,
      );
    }
  }
}
