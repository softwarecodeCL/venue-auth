import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { oauthStateCookieOptions } from './auth-cookies';
import { GOOGLE_RETURN_COOKIE, safeFrontendPath } from './auth-redirect';
import { GOOGLE_LINK_COOKIE } from './google-link';

@Catch()
export class OAuthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthExceptionFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<Request>();
    const res = host.switchToHttp().getResponse<Response>();
    const body = error instanceof HttpException ? error.getResponse() : null;
    const code = typeof body === 'object' && body && 'code' in body ? body.code : '';
    const allowed = ['GOOGLE_LINK_REQUIRED', 'GOOGLE_LINK_CONFLICT', 'GOOGLE_LINK_EXPIRED'];
    const message = typeof code === 'string' && allowed.includes(code) ? code : 'GOOGLE_LOGIN_FAILED';
    if (!(error instanceof HttpException) || error.getStatus() >= 500) this.logger.error('GOOGLE_LOGIN_FAILED');
    const returnTo = safeFrontendPath(req.cookies?.[GOOGLE_RETURN_COOKIE]);
    const prefix = /^\/(en|es)(?:\/|$)/.exec(returnTo)?.[0].replace(/\/$/, '') ?? '';
    const url = new URL(`${prefix}/login`, process.env.FRONTEND_URL || 'http://localhost:3000');
    url.searchParams.set('oauthError', message);
    url.searchParams.set('redirect', returnTo);
    for (const name of ['google_oauth_state', GOOGLE_RETURN_COOKIE, GOOGLE_LINK_COOKIE]) res.clearCookie(name, oauthStateCookieOptions());
    res.redirect(url.toString());
  }
}
