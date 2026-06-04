import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const user = request.user!;
    console.log('LOGIN USER ', user);
    if (!user) {
      return null;
    }

    return data ? user[data as keyof typeof user] : user;
  },
);
