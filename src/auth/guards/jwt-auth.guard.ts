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
    const accessToken = (request.cookies as Record<string, string> | undefined)
      ?.accessToken;
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
