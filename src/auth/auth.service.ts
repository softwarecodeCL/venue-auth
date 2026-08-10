import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const authUserSelect = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  emailVerified: true,
  locale: true,
  phone: true,
  phoneVerified: true,
  status: true,
  deletedAt: true,
  activeMode: true,
  profileCompletedAt: true,
  roles: { select: { role: true } },
} satisfies Prisma.UserSelect;

const loginUserSelect = {
  ...authUserSelect,
  passwordHash: true,
} satisfies Prisma.UserSelect;

type AuthUser = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;
type RefreshPayload = {
  sub: string;
  type: 'refresh';
  jti: string;
  familyId: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseDurationMs(
  value: string | undefined,
  fallbackMs: number,
): number {
  if (!value) return fallbackMs;

  const match = /^(\d+)(s|m|h|d)$/i.exec(value.trim());
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const units: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return amount * units[match[2].toLowerCase()];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('El email ya está registrado');

    const passwordHash = await hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash,
        authProviders: {
          create: { provider: 'local', providerUserId: email },
        },
        roles: { create: { role: Role.GUEST } },
      },
      select: authUserSelect,
    });

    return this.toPublicUser(user);
  }

  async login(dto: LoginDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: loginUserSelect,
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const matches = await compare(dto.password, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Credenciales inválidas');

    this.assertActive(user);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = await this.createSessionTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async loginWithOAuth(profile: {
    email: string | null;
    name: string | null;
    avatarUrl?: string | null;
    locale?: string | null;
    emailVerified?: boolean;
    provider: 'google';
    providerUserId?: string | null;
  }) {
    if (!profile.email || !profile.providerUserId) {
      throw new UnauthorizedException('Google no entregó una identidad válida');
    }
    if (!profile.emailVerified) {
      throw new UnauthorizedException(
        'Google no confirmó el email de la cuenta',
      );
    }

    const email = normalizeEmail(profile.email);
    const providerUserId = profile.providerUserId;
    const user = await this.prisma.$transaction(async (tx) => {
      const provider = await tx.authProvider.findUnique({
        where: {
          provider_providerUserId: {
            provider: profile.provider,
            providerUserId,
          },
        },
        select: { userId: true },
      });

      if (provider) {
        return tx.user.update({
          where: { id: provider.userId },
          data: {
            name: profile.name ?? undefined,
            avatarUrl: profile.avatarUrl ?? undefined,
            locale: profile.locale ?? undefined,
            emailVerified: true,
            lastLogin: new Date(),
            roles: {
              upsert: {
                where: {
                  userId_role: { userId: provider.userId, role: Role.GUEST },
                },
                create: { role: Role.GUEST },
                update: {},
              },
            },
          },
          select: authUserSelect,
        });
      }

      const existing = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existing) {
        await tx.authProvider.create({
          data: {
            provider: profile.provider,
            providerUserId,
            userId: existing.id,
          },
        });

        return tx.user.update({
          where: { id: existing.id },
          data: {
            name: profile.name ?? undefined,
            avatarUrl: profile.avatarUrl ?? undefined,
            locale: profile.locale ?? undefined,
            emailVerified: true,
            lastLogin: new Date(),
            roles: {
              upsert: {
                where: {
                  userId_role: { userId: existing.id, role: Role.GUEST },
                },
                create: { role: Role.GUEST },
                update: {},
              },
            },
          },
          select: authUserSelect,
        });
      }

      return tx.user.create({
        data: {
          email,
          name: profile.name,
          avatarUrl: profile.avatarUrl ?? null,
          locale: profile.locale ?? null,
          emailVerified: true,
          lastLogin: new Date(),
          authProviders: {
            create: {
              provider: profile.provider,
              providerUserId,
            },
          },
          roles: { create: { role: Role.GUEST } },
        },
        select: authUserSelect,
      });
    });

    this.assertActive(user);
    const tokens = await this.createSessionTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async getAuthenticatedUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: authUserSelect,
    });

    if (!user) throw new UnauthorizedException('Sesión inválida');
    this.assertActive(user);
    return this.toPublicUser(user);
  }

  async rotateRefreshToken(token: string | undefined) {
    if (!token) throw new UnauthorizedException('Sesión inválida');

    const payload = this.verifyRefresh(token);
    const hash = tokenHash(token);
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.jti },
      include: { user: { select: authUserSelect } },
    });

    if (
      !session ||
      session.tokenHash !== hash ||
      session.familyId !== payload.familyId
    ) {
      throw new UnauthorizedException('Sesión inválida');
    }

    if (session.revokedAt) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('La sesión fue reutilizada o revocada');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('La sesión expiró');
    }

    this.assertActive(session.user);

    const nextId = randomUUID();
    const nextToken = this.signRefresh({
      sub: session.userId,
      jti: nextId,
      familyId: session.familyId,
      type: 'refresh',
    });
    const expiresAt = this.refreshExpiresAt();
    const now = new Date();

    const rotated = await this.prisma.$transaction(async (tx) => {
      const rotated = await tx.refreshSession.updateMany({
        where: { id: session.id, tokenHash: hash, revokedAt: null },
        data: { revokedAt: now, lastUsedAt: now, replacedById: nextId },
      });

      if (rotated.count !== 1) return false;

      await tx.refreshSession.create({
        data: {
          id: nextId,
          userId: session.userId,
          familyId: session.familyId,
          tokenHash: tokenHash(nextToken),
          expiresAt,
        },
      });
      return true;
    });

    if (!rotated) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('La sesión ya fue rotada');
    }

    return {
      accessToken: this.signAccess(session.user),
      refreshToken: nextToken,
    };
  }

  async revokeRefreshToken(token: string | undefined) {
    if (!token) return;

    try {
      const payload = this.verifyRefresh(token);
      const session = await this.prisma.refreshSession.findFirst({
        where: { id: payload.jti, tokenHash: tokenHash(token) },
        select: { familyId: true },
      });

      if (session) await this.revokeFamily(session.familyId);
    } catch {
      // Logout is idempotent and must not reveal token validation details.
    }
  }

  private async createSessionTokens(user: AuthUser) {
    return {
      accessToken: this.signAccess(user),
      refreshToken: await this.issueRefresh(user.id),
    };
  }

  private signAccess(user: AuthUser) {
    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        type: 'access',
        roles: user.roles.map(({ role }) => role),
        phoneVerified: user.phoneVerified,
        activeMode: user.activeMode,
      },
      {
        secret: this.accessSecret(),
        expiresIn: process.env.JWT_EXPIRES_IN || '50m',
      },
    );
  }

  private async issueRefresh(userId: string) {
    const id = randomUUID();
    const familyId = randomUUID();
    const token = this.signRefresh({
      sub: userId,
      type: 'refresh',
      jti: id,
      familyId,
    });

    await this.prisma.refreshSession.create({
      data: {
        id,
        userId,
        familyId,
        tokenHash: tokenHash(token),
        expiresAt: this.refreshExpiresAt(),
      },
    });

    return token;
  }

  private signRefresh(payload: RefreshPayload) {
    const ttlMs = this.refreshTtlMs();
    return this.jwtService.sign(payload, {
      secret: this.refreshSecret(),
      expiresIn: Math.floor(ttlMs / 1_000),
    });
  }

  private verifyRefresh(token: string): RefreshPayload {
    try {
      const payload = this.jwtService.verify<RefreshPayload>(token, {
        secret: this.refreshSecret(),
      });

      if (
        payload.type !== 'refresh' ||
        !payload.sub ||
        !payload.jti ||
        !payload.familyId
      ) {
        throw new Error('Invalid refresh payload');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Sesión inválida');
    }
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private refreshTtlMs() {
    return parseDurationMs(
      process.env.JWT_REFRESH_EXPIRES_IN,
      30 * 24 * 60 * 60 * 1_000,
    );
  }

  private refreshExpiresAt() {
    return new Date(Date.now() + this.refreshTtlMs());
  }

  private accessSecret() {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
    return process.env.JWT_SECRET;
  }

  private refreshSecret() {
    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET is not set');
    }
    return process.env.JWT_REFRESH_SECRET;
  }

  private assertActive(user: { status: UserStatus; deletedAt: Date | null }) {
    if (user.status !== UserStatus.ACTIVE || user.deletedAt) {
      throw new UnauthorizedException('La cuenta no está activa');
    }
  }

  private toPublicUser(user: AuthUser) {
    const roles = user.roles.map(({ role }) => role);
    const profileCompleted = Boolean(user.profileCompletedAt);
    const onboardingCompleted = profileCompleted && user.phoneVerified;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      locale: user.locale,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      status: user.status,
      roles,
      activeMode: user.activeMode,
      onboarding: {
        profileCompleted,
        phoneVerified: user.phoneVerified,
        completed: onboardingCompleted,
        nextStep: !profileCompleted
          ? 'PROFILE'
          : !user.phoneVerified
            ? 'PHONE_VERIFICATION'
            : 'COMPLETE',
      },
    };
  }
}
