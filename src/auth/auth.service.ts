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
      if (!existingUser.isVerified) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashOtp = crypto.createHash('sha256').update(otp).digest('hex');

        const redisKey = `otp:user:${existingUser.id}`;
        await this.redis.set(redisKey, hashOtp, 'EX', 300);

        console.log(
          `[PRODUCTION LOG] OTP for User ${existingUser.email}: ${otp}`,
        );

        return {
          message: 'Registration successful. Please verify your OTP.',
          userId: existingUser.id,
        };
      }
      throw new BadRequestException('Email already register');
    }

    const saltRound = 10;
    const hashPassword = await bcrypt.hash(dto.password, saltRound);

    try {
      const newUser = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash: hashPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'ORGANIZER',
        },
      });

      const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 💡 Fixed to 6 digits consistency
      const hashOtp = crypto.createHash('sha256').update(otp).digest('hex');

      const redisKey = `otp:user:${newUser.id}`;
      await this.redis.set(redisKey, hashOtp, 'EX', 300);

      console.log(`[PRODUCTION LOG] OTP for User ${newUser.email}: ${otp}`);
      return {
        message: 'Registration successful. Please verify your OTP.',
        userId: newUser.id,
      };
    } catch (error) {
      console.error('Transaction Failed! Rolling back...', error);
      throw new Error('Registration failed due to a system error.');
    }
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

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updatedUser = await this.prisma.user.update({
          where: { id: dto.userId },
          data: { isVerified: true },
        });

        const firstName = updatedUser.firstName ?? 'Default';
        const newTenant = await tx.tenant.create({
          data: {
            name: `${updatedUser.firstName}'s Workspace`,
            slug: `${firstName.toLowerCase()}-workspace`,
          },
        });

        await tx.tenantMember.create({
          data: {
            tenantId: newTenant.id,
            userId: updatedUser.id,
            role: 'OWNER',
          },
        });
        await this.redis.del(redisKey);
        return {
          success: true,
          message: 'Account successfully verified. You can now log in',
          userId: updatedUser.id,
          tenantId: newTenant.id,
        };
      });
    } catch (error) {
      console.error('Transaction Failed! Rolling back...', error);
      throw new Error('Registration failed due to a system error.');
    }
  }

  async generateToken(dto: TokenGenerateDto) {
    const payload = {
      sub: dto.userId,
      email: dto.email,
      role: dto.role,
      tenantId: dto.tenantId,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET!,
      expiresIn: (process.env.JWT_ACCESS_EXPIRATION as StringValue) || '15m',
    });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: dto.userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
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

    const userTenant = await this.prisma.tenantMember.findFirst({
      where: { userId: user.id },
    });

    if (!userTenant) {
      throw new BadRequestException(
        'User is not assigned to any workspace. Contact admin.',
      );
    }

    const tokenCreateDetails: TokenGenerateDto = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: userTenant.tenantId,
    };
    const tokens = await this.generateToken(tokenCreateDetails);

    return {
      message: 'Login successful',
      data: {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
    };
  }

  async refreshToken(dto: RefreshTokenDto, tenantId: string) {
    const incomingTokenHash = crypto
      .createHash('sha256')
      .update(dto.refreshToken)
      .digest('hex');

    const existingToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: incomingTokenHash },
    });

    if (
      !existingToken ||
      existingToken.isRevoked ||
      existingToken.expiresAt < new Date()
    ) {
      await this.prisma.refreshToken.deleteMany({
        where: { id: dto.userId },
      });

      throw new UnauthorizedException(
        'Security Alert: Token reuse detected or expired.All session revoke.',
      );
    }

    await this.prisma.refreshToken.delete({
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
      tenantId: tenantId,
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

    const existingToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (existingToken) {
      await this.prisma.refreshToken.delete({
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
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return {
      success: true,
      message: 'Logged out successfully from all devices.',
    };
  }

  async searchUser(query: string) {
    return this.prisma.user.findMany({
      where: {
        email: {
          contains: query,
          mode: 'insensitive',
        },
      },
    });
  }

  async updateMuteStatus(userId: string, alertsMutedUntil: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        alertsMutedUntil: alertsMutedUntil ? new Date(alertsMutedUntil) : null,
      },
    });
  }
}
