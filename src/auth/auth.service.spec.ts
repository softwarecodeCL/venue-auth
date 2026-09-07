/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { UnauthorizedException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';

const userRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'user@example.com',
  name: 'Marco',
  avatarUrl: null,
  emailVerified: true,
  locale: 'es',
  phone: null,
  phoneVerified: false,
  status: UserStatus.ACTIVE,
  deletedAt: null,
  profileCompletedAt: null,
  roles: [{ role: Role.GUEST }],
  ...overrides,
});

describe('AuthService', () => {
  let prisma: any;
  let jwt: any;
  let service: AuthService;

  beforeEach(() => {
    process.env.JWT_SECRET = 'access-secret-for-tests';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret-for-tests';
    process.env.JWT_REFRESH_EXPIRES_IN = '30d';

    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      authProvider: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      refreshSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));

    jwt = {
      sign: jest.fn(
        (payload: any) => `${payload.type}-${payload.jti ?? 'access'}`,
      ),
      verify: jest.fn(),
    };
    service = new AuthService(prisma, jwt);
  });

  it('creates every local account with the GUEST role', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(userRecord());

    const result = await service.register({
      email: ' USER@Example.com ',
      password: 'secret123',
      name: 'Marco',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'user@example.com',
          roles: { create: { role: Role.GUEST } },
        }),
      }),
    );
    expect(result.roles).toEqual([Role.GUEST]);
    expect(result.onboarding.nextStep).toBe('PROFILE');
  });

  it('links Google to an existing verified email instead of creating a duplicate user', async () => {
    prisma.authProvider.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.authProvider.create.mockResolvedValue({ id: 'provider-1' });
    prisma.user.update.mockResolvedValue(userRecord());
    prisma.refreshSession.create.mockResolvedValue({ id: 'session-1' });

    const result = await service.loginWithOAuth({
      provider: 'google',
      providerUserId: 'google-subject-1',
      email: 'USER@example.com',
      emailVerified: true,
      name: 'Marco',
    });

    expect(prisma.authProvider.create).toHaveBeenCalledWith({
      data: {
        provider: 'google',
        providerUserId: 'google-subject-1',
        userId: 'user-1',
      },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(result.user.roles).toEqual([Role.GUEST]);
  });

  it('rejects a Google identity whose email was not verified', async () => {
    await expect(
      service.loginWithOAuth({
        provider: 'google',
        providerUserId: 'google-subject-1',
        email: 'user@example.com',
        emailVerified: false,
        name: 'Marco',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects suspended users even when the access token is valid', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userRecord({
        status: UserStatus.SUSPENDED,
      }),
    );

    await expect(service.getAuthenticatedUser('user-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('does not accept an access token as a refresh token', async () => {
    jwt.verify.mockReturnValue({ sub: 'user-1', type: 'access' });

    await expect(
      service.rotateRefreshToken('access-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshSession.findUnique).not.toHaveBeenCalled();
  });

  it('ignores refresh session errors during logout so the endpoint stays resilient', async () => {
    jwt.verify.mockReturnValue({ sub: 'user-1', type: 'refresh', jti: 'sid-1', familyId: 'family-1' });
    prisma.refreshSession.findFirst.mockRejectedValue(new Error('db down'));

    await expect(service.revokeRefreshToken('refresh-token')).resolves.toBeUndefined();
  });
});
