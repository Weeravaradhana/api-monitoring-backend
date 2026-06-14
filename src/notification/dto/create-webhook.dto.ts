import { IsNotEmpty, IsUrl, IsOptional, IsString } from 'class-validator';

export class CreateWebhookDto {
  @IsUrl({}, { message: 'Please enter a valid URL' })
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsOptional()
  secretToken?: string;
}
