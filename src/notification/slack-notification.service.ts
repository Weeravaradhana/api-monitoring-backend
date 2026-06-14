import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

@Injectable()
export class SlackNotificationService {
  private readonly logger = new Logger(SlackNotificationService.name);

  async sendSlackAlert(
    webhookUrl: string,
    status: 'UP' | 'DOWN',
    url: string,
    details: string,
  ): Promise<boolean> {
    const isDown = status === 'DOWN';

    const slackPayload = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'markdown',
            text: isDown
              ? `🚨 *CRITICAL ALERT: Monitor is DOWN*`
              : `🟢 *RECOVERY: Monitor is back UP*`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'markdown', text: `*Target URL:*\n${url}` },
            {
              type: 'markdown',
              text: `*Status:*\n${isDown ? '🔴 FAILED' : '✅ OPERATIONAL'}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'markdown',
              text: `*Details:* ${details} | _UptimeShield Automated Alert_`,
            },
          ],
        },
      ],
    };

    try {
      await axios.post(webhookUrl, slackPayload, { timeout: 5000 });
      return true;
    } catch (error: any) {
      const errMsg =
        error instanceof AxiosError ? error.message : String(error);
      this.logger.error(`Webhook delivery failed to ${url}: ${errMsg}`);
      return false;
    }
  }
}
