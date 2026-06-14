import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { JwtPayload } from '../interface/jwt-payload.interface';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: (req: Request) => {
        if (req && req.cookies) {
          return (req.cookies['accessToken'] as string) || null;
        }
        return null;
      },

    /*  jwtFromRequest: (req: Request) => {
        return (
          (req?.cookies?.accessToken as string) ||
          req?.headers?.authorization?.split(' ')[1] ||
          null
        );
      },*/

      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  validate(payload: JwtPayload) {
    return payload;
  }
}
