import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export const GOOGLE_LINK_COOKIE = 'google_link_intent';
export type GoogleLinkIntent = { sub: string; version: number; state?: string };
export function signGoogleLink(jwt: JwtService, intent: GoogleLinkIntent) {
  return jwt.sign({ ...intent, type: 'google-link' }, {
    secret: process.env.JWT_SECRET, algorithm: 'HS256', expiresIn: 300,
    audience: 'apartha-google-link',
  });
}
export function readGoogleLink(jwt: JwtService, token: unknown): GoogleLinkIntent {
  try {
    if (typeof token !== 'string') throw new Error();
    const value = jwt.verify(token, { secret: process.env.JWT_SECRET, algorithms: ['HS256'], audience: 'apartha-google-link' });
    if (value.type !== 'google-link' || typeof value.sub !== 'string' || !Number.isInteger(value.version)) throw new Error();
    return { sub: value.sub, version: value.version, state: value.state };
  } catch { throw new UnauthorizedException({ code: 'GOOGLE_LINK_EXPIRED' }); }
}
