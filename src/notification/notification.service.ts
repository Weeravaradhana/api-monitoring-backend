import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  sendFailureAlert(
    monitorId: string,
    url: string,
    statusCode: number | null,
    errorMessage: string | null,
  ) {
    this.logger.error(
      `[ALERT DISPATCHED] Monitor for ${url} is DOWN! Status Code: ${statusCode}. Error: ${errorMessage}`,
    );
  }
}
