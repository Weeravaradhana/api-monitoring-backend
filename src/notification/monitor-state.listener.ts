import { Injectable, Logger } from '@nestjs/common';
import { MonitorEngineExecutor } from '../monitor-engine/monitor-engine.executor';
import { NotificationService } from './notification.service';
import { OnEvent } from '@nestjs/event-emitter';

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
}
