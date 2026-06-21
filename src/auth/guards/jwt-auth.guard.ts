import {
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import Redis from 'ioredis';
import express from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request: express.Request = context.switchToHttp().getRequest();
    const accessToken = (request.cookies as Record<string, string> | undefined)
      ?.accessToken;
    if (!accessToken) {
      throw new UnauthorizedException(
        'Authentication token missing in cookies',
      );
    }
    if (accessToken) {
      const isBlackList = await this.redis.get(`blacklist:${accessToken}`);
      if (isBlackList) {
        throw new UnauthorizedException(
          'Access denied. This token has been revoked via logout.',
        );
      }
    }

    return (await super.canActivate(context)) as boolean;
  }
}

/*
import {
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import Redis from 'ioredis';
import express from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isValid = (await super.canActivate(context)) as boolean;
    if (!isValid) return false;

    const request: express.Request = context.switchToHttp().getRequest();
    const accessToken = request.headers.authorization?.split(' ')[1];

    if (accessToken) {
      const isBlackList = await this.redis.get(`blacklist:${accessToken}`);

      if (isBlackList) {
        throw new UnauthorizedException(
          'Access denied. This token has been revoked via logout.',
        );
      }
    }

    return true;
  }
}
*/
