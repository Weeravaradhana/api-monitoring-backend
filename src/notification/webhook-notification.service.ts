import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import axios, { AxiosError } from 'axios';

@Injectable()
export class WebhookNotificationService {
  private readonly logger = new Logger(WebhookNotificationService.name);

  async dispatchWebhook(url: string, secretToken: string | null, payload: any) {
    try {
      type Headers = Record<string, string>;
      const headers: Headers = { 'Content-Type': 'application/json' };

      if (secretToken) {
        const signature = crypto
          .createHmac('sha256', secretToken)
          .update(JSON.stringify(payload))
          .digest('hex');
        headers['x-hub-signature-256'] = `sha256=${signature}`;
      }

      await axios.post(url, payload, { headers, timeout: 5000 });
      return true;
    } catch (error) {
      const errMsg =
        error instanceof AxiosError ? error.message : String(error);
      this.logger.error(`Webhook delivery failed to ${url}: ${errMsg}`);
      return false;
    }
  }
}
