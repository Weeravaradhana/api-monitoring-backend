import { IsDateString, IsOptional } from 'class-validator';

export class UpdateMuteSettingsDto {
  @IsOptional()
  @IsDateString()
  alertsMutedUntil: string | null;
}
