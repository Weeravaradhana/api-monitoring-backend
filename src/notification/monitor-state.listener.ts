import { Injectable, Logger } from '@nestjs/common';
import { MonitorEngineExecutor } from '../monitor-engine/monitor-engine.executor';
import { NotificationService } from './notification.service';
import { OnEvent } from '@nestjs/event-emitter';
import * as monitorEventPayloadInterface from '../interface/monitor.event.payload.interface';

@Injectable()
export class MonitorStateListener {
  private readonly logger = new Logger(MonitorEngineExecutor.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent('monitor.down', { async: true })
  handleMonitorDownEvent(payload: {
    monitorId: string;
    url: string;
    statusCode: number | null;
    errorMessage: string | null;
  }) {
    this.logger.log(
      `Received 'monitor.down' event for Monitor ID: ${payload.monitorId}. Processing alert...`,
    );

    this.notificationService.sendFailureAlert(
      payload.monitorId,
      payload.url,
      payload.statusCode,
      payload.errorMessage,
    );
  }

  @OnEvent('monitor.up', { async: true })
  handleMonitorUpEvent(
    payload: monitorEventPayloadInterface.MonitorEventPayload,
  ) {
    this.logger.log(
      `Received 'monitor.up' event for [${payload.name}]. Dispatching recovery alert...`,
    );

    this.notificationService.sendRecoveryAlert(payload.monitorId, payload.url);
  }
}
