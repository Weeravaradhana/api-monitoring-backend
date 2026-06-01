import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  Min,
} from 'class-validator';
import { HttpMethods } from '../enums/http-methods.enum';
import { Type } from 'class-transformer';

export class CreateMonitorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;

  @IsEnum(HttpMethods)
  @IsNotEmpty()
  method: HttpMethods;

  @IsInt()
  @IsPositive()
  @Min(60)
  @Type(() => Number)
  interval: number;

  @IsOptional()
  @IsUUID()
  organizationId: string;
}
