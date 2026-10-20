/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { UnauthorizedException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';

const userRecord = (overrides: Record<string, unknown> = {}) => ({
  sessionVersion: 0,
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
      $executeRaw: jest.fn(),
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

  it('rejects access tokens from before a password change', async () => {
    prisma.user.findUnique.mockResolvedValue(userRecord({ sessionVersion: 1 }));
    await expect(service.getAuthenticatedUser('user-1', 0)).rejects.toThrow(UnauthorizedException);
    await expect(service.getAuthenticatedUser('user-1', 1)).resolves.toMatchObject({ id: 'user-1' });
  });

  it.each([null, { phoneE164: '+56987654321' }])('requires SMS again when the phone flag lacks matching proof: %j', async identity => {
    prisma.user.findUnique.mockResolvedValue(userRecord({ profileCompletedAt: new Date(), phone: '+56912345678', phoneVerified: true, PhoneIdentity: identity }));
    const result = await service.getAuthenticatedUser('user-1', 0);
    expect(result.phoneVerified).toBe(false);
    expect(result.onboarding.nextStep).toBe('PHONE_VERIFICATION');
    expect(result).not.toHaveProperty('PhoneIdentity');
  });

  it('keeps a consistently verified phone usable', async () => {
    prisma.user.findUnique.mockResolvedValue(userRecord({ profileCompletedAt: new Date(), phone: '+56912345678', phoneVerified: true, PhoneIdentity: { phoneE164: '+56912345678' } }));
    const result = await service.getAuthenticatedUser('user-1', 0);
    expect(result.phoneVerified).toBe(true);
    expect(result.onboarding.nextStep).toBe('COMPLETE');
  });

  it('creates every local account with the GUEST role', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(userRecord());

    const result = await service.register({
      email: ' USER@Example.com ',
      password: 'long passphrase!',
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

  it('requires explicit linking even when a matching local email is verified', async () => {
    prisma.authProvider.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(userRecord());
    await expect(service.loginWithOAuth({ provider: 'google', providerUserId: 'google-subject-1',
      email: 'USER@example.com', emailVerified: true, name: 'Marco' }))
      .rejects.toMatchObject({ response: { code: 'GOOGLE_LINK_REQUIRED' } });
    expect(prisma.authProvider.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
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
