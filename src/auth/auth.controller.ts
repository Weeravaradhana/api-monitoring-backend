import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GetUser } from './decorators/get-user.decorator';
import * as jwtPayloadInterface from './interface/jwt-payload.interface';
import { UpdateMuteSettingsDto } from './dto/update-mute-setting.dto';
import { Public } from './decorators/public.decorator';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import express from 'express';

interface JwtUser {
  sub: string;
  tenantId: string;
  role: string;
}

@Controller('auth')
class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('verify-otp')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('login')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@GetUser() user: JwtUser) {
    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      userId: user.sub,
      tenantId: user.tenantId,
      role: user.role,
    };
  }

  @Post('refresh')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @GetUser('tenantId') tenantId: string,
  ) {
    return this.authService.refreshToken(dto, tenantId);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: express.Request,
    @GetUser() jwtPayload: jwtPayloadInterface.JwtPayload,
  ) {
    const accessToken = req.headers.authorization!.split('')[1];
    return this.authService.logout(dto.refreshToken, accessToken, jwtPayload);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchUser(@Query('q') query: string) {
    return await this.authService.searchUser(query);
  }

  @Patch('mute-settings')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateMuteSettings(
    @GetUser('sub') userId: string,
    @Body() dto: UpdateMuteSettingsDto,
  ) {
    return await this.authService.updateMuteStatus(
      userId,
      dto.alertsMutedUntil,
    );
  }

  @Post('switch-tenant')
  @UseGuards(JwtAuthGuard)
  async switchTenant(
    @Body() dto: SwitchTenantDto,
    @GetUser() user: JwtUser,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }
    const accessToken  = await this.authService.switchTenant(
      user.sub,
      dto.tenantId,
    );

    response.cookie('accessToken', accessToken.accessToken.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    return { success: true };
  }
}

export default AuthController;
