import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { oauthStateCookieOptions } from '../auth-cookies';

const STATE_COOKIE = 'google_oauth_state';

@Injectable()
export class GoogleOAuthStartGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const response = context.switchToHttp().getResponse<Response>();
    const state = randomBytes(32).toString('base64url');

    response.cookie(STATE_COOKIE, state, {
      ...oauthStateCookieOptions(),
      maxAge: 10 * 60 * 1_000,
    });

    return { state };
  }
}

@Injectable()
export class GoogleOAuthCallbackGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const rawCookies = (
      request as unknown as { cookies?: Record<string, unknown> }
    ).cookies;
    const rawExpected = rawCookies?.[STATE_COOKIE];
    const expected = typeof rawExpected === 'string' ? rawExpected : undefined;
    const received =
      typeof request.query.state === 'string' ? request.query.state : undefined;

    response.clearCookie(STATE_COOKIE, oauthStateCookieOptions());

    if (!expected || !received || !this.matches(expected, received)) {
      throw new UnauthorizedException('El inicio de sesión con Google expiró');
    }

    return super.canActivate(context);
  }

  private matches(expected: string, received: string) {
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    return (
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  }
}
