import { IsNotEmpty, IsUrl, IsOptional, IsString } from 'class-validator';

export class ConfigureSlackDto {
  @IsUrl({}, { message: 'Please enter a valid Slack Webhook URL' })
  @IsNotEmpty()
  webhookUrl: string;

  @IsString()
  @IsOptional()
  channelName?: string;
}
