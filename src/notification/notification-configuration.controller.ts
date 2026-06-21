import {
  Controller,
  Post,
  Body,
  Delete,
  Param,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationConfigService } from './notification-configuration.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { ConfigureSlackDto } from './dto/configure-slack.dto';

@Controller('notifications/config')
@UseGuards(JwtAuthGuard)
export class NotificationConfigController {
  constructor(private readonly configService: NotificationConfigService) {}

  @Post('webhooks')
  async addWebhook(
    @GetUser('tenantId') tenantId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return await this.configService.addWebhook(tenantId, dto);
  }

  @Get('webhooks')
  async getWebhooks(@GetUser('tenantId') tenantId: string) {
    return await this.configService.getWebhooks(tenantId);
  }

  @Delete('webhooks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWebhook(
    @GetUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    await this.configService.deleteWebhook(tenantId, id);
  }

  @Post('slack')
  async configureSlack(
    @GetUser('tenantId') tenantId: string,
    @Body() dto: ConfigureSlackDto,
  ) {
    return await this.configService.configureSlack(tenantId, dto);
  }

  @Get('slack')
  async getSlackConfig(@GetUser('tenantId') tenantId: string) {
    return await this.configService.getSlackConfig(tenantId);
  }

  @Delete('slack')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeSlack(@GetUser('tenantId') tenantId: string) {
    await this.configService.removeSlack(tenantId);
  }
}
