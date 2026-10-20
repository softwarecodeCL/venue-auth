import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GOOGLE_LINK_COOKIE, readGoogleLink, signGoogleLink } from '../google-link';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { oauthStateCookieOptions } from '../auth-cookies';
import { GOOGLE_RETURN_COOKIE, safeFrontendPath } from '../auth-redirect';

const STATE_COOKIE = 'google_oauth_state';

@Injectable()
export class GoogleOAuthStartGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const response = context.switchToHttp().getResponse<Response>();
    const request = context.switchToHttp().getRequest<Request>();
    const state = randomBytes(32).toString('base64url');
    if (request.query.link === '1') {
      const jwt = new JwtService();
      const intent = readGoogleLink(jwt, request.cookies?.[GOOGLE_LINK_COOKIE]);
      // Bind the explicit intent to this browser's existing account and OAuth state.
      let access: any;
      try { access = jwt.verify(request.cookies?.access_token, { secret: process.env.JWT_SECRET, algorithms: ['HS256'] }); }
      catch { throw new UnauthorizedException({ code: 'GOOGLE_LINK_EXPIRED' }); }
      if (access.type !== 'access' || access.sub !== intent.sub || access.version !== intent.version || intent.state) {
        throw new UnauthorizedException({ code: 'GOOGLE_LINK_EXPIRED' });
      }
      response.cookie(GOOGLE_LINK_COOKIE, signGoogleLink(jwt, { ...intent, state }), { ...oauthStateCookieOptions(), maxAge: 5 * 60_000 });
    } else {
      response.clearCookie(GOOGLE_LINK_COOKIE, oauthStateCookieOptions());
    }

    response.cookie(STATE_COOKIE, state, {
      ...oauthStateCookieOptions(),
      maxAge: 10 * 60 * 1_000,
    });
    response.cookie(GOOGLE_RETURN_COOKIE, safeFrontendPath(request.query.returnTo), {
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

    if (rawCookies?.[GOOGLE_LINK_COOKIE]) {
      const jwt = new JwtService();
      const intent = readGoogleLink(jwt, rawCookies[GOOGLE_LINK_COOKIE]);
      let access: any;
      try { access = jwt.verify(String(rawCookies.access_token || ''), { secret: process.env.JWT_SECRET, algorithms: ['HS256'] }); }
      catch { throw new UnauthorizedException({ code: 'GOOGLE_LINK_EXPIRED' }); }
      if (intent.state !== received || access.type !== 'access' || access.sub !== intent.sub || access.version !== intent.version) {
        throw new UnauthorizedException({ code: 'GOOGLE_LINK_EXPIRED' });
      }
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
