import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class RefreshTokenDto{
  @IsUUID('4',{message: 'Invalid user ID formate'})
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  refreshToken!: string
}