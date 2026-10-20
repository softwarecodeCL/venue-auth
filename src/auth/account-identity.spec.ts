import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';

describe('Google and password account identity', () => {
  let prisma: any;
  let service: AuthService;
  const user = { id: 'original', email: 'guest@example.com', status: 'ACTIVE', deletedAt: null, sessionVersion: 0, emailVerified: true,
    passwordHash: 'trusted-hash', passwordVerifiedAt: new Date(),
    phone: '+56912345678', phoneVerified: true, PhoneIdentity: { phoneE164: '+56912345678' }, profileCompletedAt: new Date(), roles: [{ role: 'GUEST' }] };
  const profile = { email: ' Guest@Example.com ', name: 'Guest', provider: 'google' as const,
    providerUserId: 'google-subject', emailVerified: true };
  const conflict = () => new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
  beforeEach(() => {
    prisma = {
      $executeRaw: jest.fn(),
      user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn().mockResolvedValue(user), create: jest.fn().mockResolvedValue(user) },
      authProvider: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    prisma.$transaction = jest.fn((fn: any) => fn(prisma));
    service = new AuthService(prisma, {} as any);
    jest.spyOn(service as any, 'createSessionTokens').mockResolvedValue({ accessToken: 'test' });
  });
  it('explicitly links Google after authenticated password proof and preserves verified phone', async () => {
    const result = await service.loginWithOAuth(profile, { sub: user.id, version: 0 });
    expect(result.user.id).toBe(user.id);
    expect(result.user.phoneVerified).toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: user.email } }));
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.authProvider.create).toHaveBeenCalledWith({ data: { provider: 'google', providerUserId: 'google-subject', userId: user.id } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it('does not overwrite Google users through public password registration', async () => {
    await expect(service.register({ email: user.email, name: 'Guest', password: 'long password!' })).rejects.toMatchObject({ response: { code: 'ACCOUNT_ALREADY_EXISTS' } });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it('resolves a concurrent OAuth insert using the provider identity', async () => {
    prisma.$transaction.mockRejectedValueOnce(conflict());
    prisma.authProvider.findUnique.mockResolvedValue({ userId: user.id });
    expect((await service.loginWithOAuth(profile)).user.id).toBe(user.id);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.authProvider.create).not.toHaveBeenCalled();
  });
  it('reports a registration race as an account conflict, not a 500', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(conflict());
    await expect(service.register({ email: user.email, name: 'Guest', password: 'long password!' })).rejects.toMatchObject({ response: { code: 'ACCOUNT_ALREADY_EXISTS' } });
  });
  it('requires a verified email and stable provider subject before any lookup', async () => {
    await expect(service.loginWithOAuth({ ...profile, emailVerified: false })).rejects.toThrow();
    await expect(service.loginWithOAuth({ ...profile, providerUserId: '' })).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
