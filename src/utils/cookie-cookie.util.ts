import { Response } from 'express';

export class CookieUtil {
  static setAuthCookie(response: Response, token: string): void {
    response.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
  }
}
