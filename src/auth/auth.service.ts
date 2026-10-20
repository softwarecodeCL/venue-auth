import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { queueAccountEmail } from './account-email';
import { assertNewPassword } from './password-policy';
import { GoogleLinkIntent, signGoogleLink } from './google-link';
import { hasVerifiedPhone } from '../user/verified-phone';

const dummyPasswordHash = hash(randomBytes(32).toString('hex'), 12);

const authUserSelect = {
  sessionVersion: true,
  passwordHash: true,
  passwordVerifiedAt: true,
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  emailVerified: true,
  locale: true,
  phone: true,
  phoneVerified: true,
  phoneVerifiedAt: true,
  PhoneIdentity: { select: { phoneE164: true } },
  status: true,
  deletedAt: true,
  profileCompletedAt: true,
  roles: { select: { role: true } },
  authProviders: { select: { provider: true } },
} satisfies Prisma.UserSelect;

const loginUserSelect = {
  ...authUserSelect,
  passwordHash: true,
  passwordVerifiedAt: true,
} satisfies Prisma.UserSelect;

type AuthUser = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;
type RefreshPayload = {
  sub: string;
  type: 'refresh';
  version?: number;
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
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.password !== undefined) assertNewPassword(dto.password);
    const email = normalizeEmail(dto.email);
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException({ code: 'ACCOUNT_ALREADY_EXISTS' });

    const user = await this.prisma.$transaction(async tx => {
    const created = await tx.user.create({
      data: {
        email,
        name: dto.name.trim(),
        // The email owner chooses the credential only after opening the one-use link.
        passwordHash: null,
        locale: dto.locale ?? 'es',
        authProviders: {
          create: { provider: 'local', providerUserId: email },
        },
        roles: { create: { role: Role.GUEST } },
      },
      select: authUserSelect,
    });
    // Welcome is queued after email proof, not while this account is pending.
    return created;
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException({ code: 'ACCOUNT_ALREADY_EXISTS' });
      }
      throw error;
    });

    return this.toPublicUser(user);
  }

  async login(dto: LoginDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: loginUserSelect,
    });

    const matches = await compare(dto.password, user?.passwordHash || await dummyPasswordHash);
    if (!user?.passwordHash || !matches) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });

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
  }, link?: GoogleLinkIntent) {
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
    const user = await this.retryIdentityConflict(() => this.prisma.$transaction(async (tx) => {
      // Serialize provider resolution, password reset and explicit linking for this email.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`identity:${email}`}))`;
      const provider = await tx.authProvider.findUnique({
        where: {
          provider_providerUserId: {
            provider: profile.provider,
            providerUserId,
          },
        },
        select: { userId: true },
      });

      if (link && provider && provider.userId !== link.sub) {
        throw new ConflictException({ code: 'GOOGLE_LINK_CONFLICT' });
      }
      if (provider && !link) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`password:${provider.userId}`}))`;
        const current = await tx.user.findUnique({ where: { id: provider.userId }, select: authUserSelect });
        if (!current) throw new UnauthorizedException();
        if (current.status !== UserStatus.ACTIVE || current.deletedAt) throw new UnauthorizedException();
        // Legacy auto-linked accounts may retain a password set by someone else.
        // Google proves its provider identity; remove only that unproven credential.
        if (current.passwordHash && !current.passwordVerifiedAt) {
          const now = new Date();
          await tx.user.update({ where: { id: current.id }, data: { passwordHash: null, sessionVersion: { increment: 1 } } });
          await tx.refreshSession.updateMany({ where: { userId: current.id, revokedAt: null }, data: { revokedAt: now } });
          await tx.passwordResetToken.updateMany({ where: { userId: current.id, usedAt: null }, data: { usedAt: now } });
        }
        return tx.user.update({
          where: { id: provider.userId },
          data: {
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

      const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (link) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`password:${link.sub}`}))`;
        const account = await tx.user.findUnique({ where: { id: link.sub }, select: authUserSelect });
        if (!account || account.sessionVersion !== link.version || !account.passwordVerifiedAt || !account.passwordHash || !account.emailVerified
          || account.email !== email || existing?.id !== link.sub) {
          throw new ConflictException({ code: 'GOOGLE_LINK_CONFLICT' });
        }
        this.assertActive(account);
        // Multiple callbacks are harmless; an identity can never move between users.
        if (!provider) {
          await tx.authProvider.create({ data: { provider: 'google', providerUserId, userId: account.id } });
          await queueAccountEmail(tx, account.id, 'GOOGLE_LINKED', `google-linked:${account.id}:${providerUserId}`);
        }
        return account;
      }
      if (existing) throw new ConflictException({ code: 'GOOGLE_LINK_REQUIRED' });

      const created = await tx.user.create({
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
      await queueAccountEmail(tx, created.id, 'ACCOUNT_CREATED', `account-created:${created.id}`);
      return created;
    }));

    this.assertActive(user);
    const tokens = await this.createSessionTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async googleLinkIntent(userId: string, currentPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: authUserSelect });
    if (!user?.passwordHash || !user.passwordVerifiedAt || !user.emailVerified || !await compare(currentPassword, user.passwordHash)) {
      // A wrong confirmation password is not an expired session. Returning 401
      // would trigger the client's refresh/retry and consume the quota twice.
      throw new BadRequestException({ code: 'PASSWORD_CURRENT_INVALID' });
    }
    this.assertActive(user);
    return signGoogleLink(this.jwtService, { sub: user.id, version: user.sessionVersion });
  }

  private async retryIdentityConflict<T>(operation: () => Promise<T>): Promise<T> {
    // Concurrent OAuth callbacks or registration can win the unique insert.
    // Restart the transaction and resolve the identity that was just created.
    for (let attempt = 0; ; attempt++) {
      try { return await operation(); }
      catch (error) {
        if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      }
    }
  }

  async getAuthenticatedUser(userId: string, version = 0) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: authUserSelect,
    });

    if (!user || user.sessionVersion !== version) throw new UnauthorizedException('Sesión inválida');
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
      session.userId !== payload.sub ||
      session.tokenHash !== hash ||
      session.familyId !== payload.familyId
    ) {
      throw new UnauthorizedException('Sesión inválida');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('La sesión expiró');
    }

    this.assertActive(session.user);
    if ((payload.version ?? 0) !== session.user.sessionVersion) throw new UnauthorizedException('Sesión revocada');

    if (session.revokedAt) {
      return this.recoverConcurrentRotation(session, payload);
    }

    const nextId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.refreshTtlMs());
    const nextToken = this.signRefresh({
      sub: session.userId,
      jti: nextId,
      familyId: session.familyId,
      type: 'refresh',
      version: session.user.sessionVersion,
    }, now, expiresAt);

    const rotated = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`auth:refresh:${session.familyId}`}))`;
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
          createdAt: now,
        },
      });
      return true;
    });

    if (!rotated) {
      const current = await this.prisma.refreshSession.findUnique({
        where: { id: session.id },
        include: { user: { select: authUserSelect } },
      });
      if (current) return this.recoverConcurrentRotation(current, payload);
      throw new UnauthorizedException('Sesión inválida');
    }

    return {
      accessToken: this.signAccess(session.user),
      refreshToken: nextToken,
    };
  }

  // Parallel tabs or SSR requests may present the same cookie before either
  // response reaches the browser. Return the SAME successor briefly; never
  // create a second branch, revive a logged-out family, or accept old replay.
  private async recoverConcurrentRotation(
    session: {
      familyId: string; userId: string; revokedAt: Date | null;
      replacedById: string | null; user: AuthUser;
    },
    payload: RefreshPayload,
  ) {
    this.assertActive(session.user);
    if ((payload.version ?? 0) !== session.user.sessionVersion) {
      throw new UnauthorizedException('Sesión revocada');
    }
    const elapsed = session.revokedAt ? Date.now() - session.revokedAt.getTime() : Infinity;
    if (session.replacedById && elapsed >= 0 && elapsed <= 10_000) {
      const successor = await this.prisma.refreshSession.findUnique({
        where: { id: session.replacedById },
      });
      if (successor && !successor.revokedAt &&
          successor.familyId === session.familyId && successor.userId === session.userId &&
          successor.expiresAt.getTime() > Date.now()) {
        const token = this.signRefresh({
          sub: session.userId, type: 'refresh', jti: successor.id,
          familyId: session.familyId, version: session.user.sessionVersion,
        }, successor.createdAt, successor.expiresAt);
        if (tokenHash(token) === successor.tokenHash) {
          return { accessToken: this.signAccess(session.user), refreshToken: token };
        }
      }
    }
    await this.revokeFamily(session.familyId);
    throw new UnauthorizedException('La sesión fue reutilizada o revocada');
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
      // No token, cookie, or account data belongs in logout diagnostics.
      this.logger.warn('Logout could not revoke the refresh session; cookies will still be cleared');
    }
  }

  private async createSessionTokens(user: AuthUser) {
    return {
      accessToken: this.signAccess(user),
      refreshToken: await this.issueRefresh(user.id, user.sessionVersion),
    };
  }

  private signAccess(user: AuthUser) {
    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        type: 'access',
        version: user.sessionVersion,
        roles: user.roles.map(({ role }) => role),
        phoneVerified: user.phoneVerified,
      },
      {
        secret: this.accessSecret(),
        expiresIn: Math.floor(this.sessionCookieMaxAge().access / 1_000),
      },
    );
  }

  private async issueRefresh(userId: string, version: number) {
    const id = randomUUID();
    const familyId = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + this.refreshTtlMs());
    const token = this.signRefresh({
      sub: userId,
      type: 'refresh',
      version,
      jti: id,
      familyId,
    }, createdAt, expiresAt);

    await this.prisma.refreshSession.create({
      data: {
        id,
        userId,
        familyId,
        tokenHash: tokenHash(token),
        expiresAt,
        createdAt,
      },
    });

    return token;
  }

  private signRefresh(payload: RefreshPayload, createdAt: Date, expiresAt: Date) {
    return this.jwtService.sign({
      sub: payload.sub,
      type: payload.type,
      version: payload.version ?? 0,
      jti: payload.jti,
      familyId: payload.familyId,
      iat: Math.floor(createdAt.getTime() / 1_000),
      exp: Math.floor(expiresAt.getTime() / 1_000),
    }, {
      secret: this.refreshSecret(),
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
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`auth:refresh:${familyId}`}))`;
      await tx.refreshSession.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  private refreshTtlMs() {
    return parseDurationMs(
      process.env.JWT_REFRESH_EXPIRES_IN,
      30 * 24 * 60 * 60 * 1_000,
    );
  }

  sessionCookieMaxAge() {
    return {
      access: parseDurationMs(process.env.JWT_EXPIRES_IN, 50 * 60 * 1_000),
      refresh: this.refreshTtlMs(),
    };
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

  private assertActive(user: { status: UserStatus; deletedAt: Date | null; passwordHash?: string | null; passwordVerifiedAt?: Date | null; emailVerified?: boolean }) {
    if (user.status !== UserStatus.ACTIVE || user.deletedAt) {
      throw new UnauthorizedException('La cuenta no está activa');
    }
    if (user.emailVerified === false || (user.passwordHash && !user.passwordVerifiedAt)) {
      throw new UnauthorizedException({ code: 'EMAIL_VERIFICATION_REQUIRED' });
    }
  }

  private toPublicUser(user: AuthUser) {
    const roles = user.roles.map(({ role }) => role);
    const profileCompleted = Boolean(user.profileCompletedAt);
    const phoneVerified = hasVerifiedPhone(user);
    const onboardingCompleted = profileCompleted && phoneVerified;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      hasPassword: Boolean(user.passwordHash && user.passwordVerifiedAt),
      googleLinked: Boolean(user.authProviders?.some(item => item.provider === 'google')),
      locale: user.locale,
      phone: user.phone,
      phoneVerified,
      phoneVerifiedAt: phoneVerified ? user.phoneVerifiedAt : null,
      status: user.status,
      roles,
      onboarding: {
        profileCompleted,
        phoneVerified,
        completed: onboardingCompleted,
        nextStep: !profileCompleted
          ? 'PROFILE'
          : !phoneVerified
            ? 'PHONE_VERIFICATION'
            : 'COMPLETE',
      },
    };
  }
}
