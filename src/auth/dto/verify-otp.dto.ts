import { IsNotEmpty, IsString, IsUUID, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsUUID('4', { message: 'Invalid User ID format' })
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}