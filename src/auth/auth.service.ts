import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { TokenGenerateDto } from './dto/token-generate.dto';
import { StringValue } from 'ms';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './interface/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already register');
    }

    const saltRound = 10;
    const hashPassword = await bcrypt.hash(dto.password, saltRound);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'USER',
      },
    });

    const otp = Math.floor(1000 + Math.random() * 900000).toString();

    const hashOtp = crypto.createHash('sha256').update(otp).digest('hex');

    const redisKey = `otp:user:${user.id}`;
    await this.redis.set(redisKey, hashOtp, 'EX', 300);

    console.log(`[PRODUCTION LOG] OTP for User ${user.email}: ${otp}`);

    return {
      message: 'Registration successful. Please verify your OTP.',
      userId: user.id,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const redisKey = `otp:user:${dto.userId}`;

    const storeHashOtp = await this.redis.get(redisKey);

    if (!storeHashOtp) {
      throw new BadRequestException('OTP has expired or invalid user ID');
    }

    const clientHashOtp = crypto
      .createHash('sha256')
      .update(dto.otp)
      .digest('hex');

    if (storeHashOtp !== clientHashOtp) {
      throw new BadRequestException('Invalid OTP code');
    }

    await this.prisma.user.update({
      where: { id: dto.userId },
      data: { isVerified: true },
    });

    await this.redis.del(redisKey);

    return {
      success: true,
      message: 'Account successfully verified. You can now log in',
    };
  }

  async generateToken(dto: TokenGenerateDto) {
    const payload = {
      sub: dto.email,
      email: dto.email,
      role: dto.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET!,
      expiresIn: (process.env.JWT_ACCESS_EXPIRATION as StringValue) || '15ms',
    });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refeshToken.create({
      data: {
        token: tokenHash,
        userId: dto.userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToke: rawRefreshToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isVerified) {
      throw new BadRequestException(
        'Please verify your email via OTP before logging in',
      );
    }

    const isPasswordMatch = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokenCreateDetails: TokenGenerateDto = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = await this.generateToken(tokenCreateDetails);

    return {
      message: 'Login successful',
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const incomingTokenHash = crypto
      .createHash('sha256')
      .update(dto.refreshToken)
      .digest('hex');

    const existingToken = await this.prisma.refeshToken.findUnique({
      where: { token: incomingTokenHash },
    });

    if (
      !existingToken ||
      existingToken.isRevoked ||
      existingToken.expiresAt < new Date()
    ) {
      await this.prisma.user.deleteMany({
        where: { id: dto.userId },
      });

      throw new UnauthorizedException(
        'Security Alert: Token reuse detected or expired.All session revoke.',
      );
    }

    await this.prisma.refeshToken.delete({
      where: { id: existingToken.id },
    });

    const selectedUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!selectedUser) throw new UnauthorizedException('User not found');

    const tokenCreateDetails: TokenGenerateDto = {
      userId: selectedUser.id,
      email: selectedUser.email,
      role: selectedUser.role,
    };

    const generatedTokens = await this.generateToken(tokenCreateDetails);

    return {
      message: 'Token rotated successfully',
      ...generatedTokens,
    };
  }

  async logout(
    refreshToken: string,
    accessToken: string,
    jwtPayload: JwtPayload,
  ) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const existingToken = await this.prisma.refeshToken.findUnique({
      where: { token: tokenHash },
    });

    if (existingToken) {
      await this.prisma.refeshToken.delete({
        where: { id: existingToken.id },
      });
    }

    const currentTimeInSecond = Math.floor(Date.now() / 1000);
    const remainingTTL = jwtPayload?.exp - currentTimeInSecond;

    if (remainingTTL > 0) {
      await this.redis.set(
        `blacklist:${accessToken}`,
        'revoked',
        'EX',
        remainingTTL,
      );
    }

    return {
      success: true,
      message: 'Logged out successfully. Tokens invalidated.',
    };
  }

  async logoutAll(userId: string) {
    await this.prisma.refeshToken.deleteMany({
      where: { userId },
    });

    return {
      success: true,
      message: 'Logged out successfully from all devices.',
    };
  }
}
