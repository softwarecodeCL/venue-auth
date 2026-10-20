import { createHash } from 'node:crypto';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { AuthModule } from './auth.module';
import { safeFrontendPath } from './auth-redirect';

describe('Refresh session lifecycle', () => {
  let jwt: JwtService;
  const digest = (token: string) => createHash('sha256').update(token).digest('hex');
  let service: AuthService;
  let rows: Map<string, any>;
  let prisma: any;
  let token: string;
  const user = {
    id: 'user-1', email: 'guest@example.com', name: 'Guest', sessionVersion: 0,
    status: UserStatus.ACTIVE, deletedAt: null, phoneVerified: true,
    profileCompletedAt: new Date(), roles: [{ role: Role.GUEST }],
  };
  beforeEach(() => {
    process.env.JWT_SECRET = 'access-session-test-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-session-test-secret';
    process.env.JWT_REFRESH_EXPIRES_IN = '30d';
    process.env.JWT_EXPIRES_IN = '15m';
    const jwtRegistration = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule) as any[])
      .find(entry => entry.module === JwtModule);
    const jwtOptions = jwtRegistration.providers.find((provider: any) => provider.provide === 'JWT_MODULE_OPTIONS').useValue;
    jwt = new JwtService(jwtOptions);
    rows = new Map();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 86_400_000);
    token = jwt.sign({ sub: user.id, type: 'refresh', jti: 'old', familyId: 'family', version: 0 }, {
      secret: process.env.JWT_REFRESH_SECRET, expiresIn: 86400,
    });
    rows.set('old', { id: 'old', userId: user.id, familyId: 'family', tokenHash: digest(token),
      createdAt, expiresAt, revokedAt: null, replacedById: null });
    prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      refreshSession: {
        findUnique: jest.fn(async ({ where, include }) => {
          const row = rows.get(where.id);
          return row ? { ...row, ...(include ? { user: { ...user } } : {}) } : null;
        }),
        findFirst: jest.fn(async ({ where }) => {
          const row = rows.get(where.id);
          return row?.tokenHash === where.tokenHash ? { ...row } : null;
        }),
        create: jest.fn(async ({ data }) => { rows.set(data.id, { revokedAt: null, replacedById: null, ...data }); return data; }),
        updateMany: jest.fn(async ({ where, data }) => {
          let count = 0;
          for (const row of rows.values()) {
            if (Object.entries(where).every(([key, value]) => row[key] === value)) { Object.assign(row, data); count++; }
          }
          return { count };
        }),
      },
    };
    // Model serialized database transactions while allowing reads to overlap.
    let queue = Promise.resolve();
    prisma.$transaction = (work: any) => {
      const next = queue.then(() => work(prisma));
      queue = next.catch(() => undefined);
      return next;
    };
    service = new AuthService(prisma, jwt);
  });

  it('renews expired access with a live refresh session and configured lifetimes', async () => {
    const result = await service.rotateRefreshToken(token);
    const access = jwt.verify(result.accessToken, { secret: process.env.JWT_SECRET });
    expect(access.exp - access.iat).toBe(15 * 60);
    expect(service.sessionCookieMaxAge()).toEqual({ access: 900_000, refresh: 30 * 86_400_000 });
    expect(rows.get('old').revokedAt).toBeInstanceOf(Date);
    expect(rows.get(rows.get('old').replacedById).tokenHash).toBe(digest(result.refreshToken));
  });

  it('issues a refresh token through the configured JwtModule without conflicting expiry options', async () => {
    const issued = await service['issueRefresh'](user.id, user.sessionVersion);
    const payload = jwt.verify(issued, { secret: process.env.JWT_REFRESH_SECRET });
    expect(payload.exp).toBeGreaterThan(payload.iat);
    expect(rows.get(payload.jti).tokenHash).toBe(digest(issued));
  });

  it('returns the same successor for concurrent refreshes without revoking the family', async () => {
    const [first, second] = await Promise.all([service.rotateRefreshToken(token), service.rotateRefreshToken(token)]);
    expect(first.refreshToken).toBe(second.refreshToken);
    expect(rows.size).toBe(2);
    expect([...rows.values()].filter(row => !row.revokedAt)).toHaveLength(1);
    await expect(service.rotateRefreshToken(first.refreshToken)).resolves.toHaveProperty('accessToken');
  });

  it('revokes the family on replay outside the concurrency window', async () => {
    await service.rotateRefreshToken(token);
    rows.get('old').revokedAt = new Date(Date.now() - 11_000);
    await expect(service.rotateRefreshToken(token)).rejects.toThrow(UnauthorizedException);
    expect([...rows.values()].every(row => row.revokedAt)).toBe(true);
  });

  it('cannot restore a family after logout, even during the concurrency window', async () => {
    const result = await service.rotateRefreshToken(token);
    await service.revokeRefreshToken(result.refreshToken);
    await expect(service.rotateRefreshToken(token)).rejects.toThrow(UnauthorizedException);
    await expect(service.rotateRefreshToken(result.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('serializes rotation and logout so that no live successor remains', async () => {
    await Promise.allSettled([service.rotateRefreshToken(token), service.revokeRefreshToken(token)]);
    expect([...rows.values()].every(row => row.revokedAt)).toBe(true);
  });

  it('does not reconstruct a successor whose stored hash does not match', async () => {
    await service.rotateRefreshToken(token);
    rows.get(rows.get('old').replacedById).tokenHash = 'different';
    await expect(service.rotateRefreshToken(token)).rejects.toThrow(UnauthorizedException);
  });

  it('keeps logout idempotent for missing, malformed, and repeated cookies', async () => {
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await expect(service.revokeRefreshToken(undefined)).resolves.toBeUndefined();
    await expect(service.revokeRefreshToken('invalid')).resolves.toBeUndefined();
    await service.revokeRefreshToken(token);
    await expect(service.revokeRefreshToken(token)).resolves.toBeUndefined();
    warning.mockRestore();
  });

  it('catches database cleanup failures during logout without an unhandled rejection', async () => {
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma.refreshSession.updateMany.mockRejectedValue(new Error('database unavailable'));
    await expect(service.revokeRefreshToken(token)).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('cookies will still be cleared'));
    warning.mockRestore();
  });
});

describe('OAuth return path', () => {
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/login', '/en/register', '/\nattack'])('rejects unsafe or looping path %s', value => {
    expect(safeFrontendPath(value)).toBe('/');
  });
  it('preserves a local localized destination and its query', () => {
    expect(safeFrontendPath('/en/listing/123?checkout=1')).toBe('/en/listing/123?checkout=1');
  });
});
