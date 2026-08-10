// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { AuthService } from '../auth.service';

function cookieExtractor(req: Request): string | null {
  const cookies = (req as unknown as { cookies?: Record<string, unknown> })
    .cookies;
  const token = cookies?.access_token;
  return typeof token === 'string' ? token : null;
}

function bearerExtractor(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice(7).trim() || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
    super({
      jwtFromRequest: (request: Request) =>
        cookieExtractor(request) ?? bearerExtractor(request),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub: string; type?: string }) {
    if (!payload.sub || (payload.type && payload.type !== 'access')) {
      throw new UnauthorizedException('Token de acceso inválido');
    }
    return this.authService.getAuthenticatedUser(payload.sub);
  }
}
