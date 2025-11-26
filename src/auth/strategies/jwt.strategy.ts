// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client'

function cookieExtractor(req: Request): string | null {
  // lee solo desde la cookie HttpOnly "access_token"
  return req?.cookies?.access_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub: string }) {
    console.log("<-------------------------------->");
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, avatarUrl: true, locale: true, phone: true, aboutMe: true },
    });
    
    if (!user) throw new UnauthorizedException();
    return user; // ← esto será req.user en /auth/me
  }
}
