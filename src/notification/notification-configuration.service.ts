import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { ConfigureSlackDto } from './dto/configure-slack.dto';

@Injectable()
export class NotificationConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async addWebhook(tenantId: string, dto: CreateWebhookDto) {
    return this.prisma.webhookConfig.create({
      data: {
        tenantId,
        url: dto.url,
        secretToken: dto.secretToken,
      },
    });
  }

  async getWebhooks(tenantId: string) {
    return this.prisma.webhookConfig.findMany({
      where: { tenantId },
    });
  }

  async deleteWebhook(tenantId: string, id: string): Promise<void> {
    const result = await this.prisma.webhookConfig.deleteMany({
      where: { id, tenantId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Webhook config not found or unauthorized.');
    }
  }

  async configureSlack(tenantId: string, dto: ConfigureSlackDto) {
    return this.prisma.slackConfig.upsert({
      where: { tenantId },
      update: {
        webhookUrl: dto.webhookUrl,
        channelName: dto.channelName,
        isActive: true,
      },
      create: {
        tenantId,
        webhookUrl: dto.webhookUrl,
        channelName: dto.channelName,
      },
    });
  }

  async getSlackConfig(tenantId: string) {
    const config = await this.prisma.slackConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      throw new NotFoundException(
        'Slack configuration not found for this tenant.',
      );
    }

    return config;
  }

  async removeSlack(tenantId: string): Promise<void> {
    try {
      await this.prisma.slackConfig.delete({
        where: { tenantId },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(
          'Slack configuration not found or already deleted.',
        );
      }
    }
  }

  async muteUserAlerts(userId: string, durationInHours: number) {
    const muteUntil = new Date(Date.now() + durationInHours * 3600000);

    return this.prisma.user.update({
      where: { id: userId },
      data: { alertsMutedUntil: muteUntil },
    });
  }
}
