/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Role } from '@prisma/client';
import { UserService } from './user.service';

describe('UserService', () => {
  let prisma: any;
  let service: UserService;

  beforeEach(() => {
    prisma = {
      $executeRaw: jest.fn(),
      user: { update: jest.fn(), findUnique: jest.fn() },
      userRole: { upsert: jest.fn() },
      providerProfile: { upsert: jest.fn() },
    };
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));
    service = new UserService(prisma);
  });

  it('activates HOST without removing the mandatory GUEST role', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await service.completeProfile('user-1', {
      name: ' Marco ',
      mode: Role.HOST,
      hostDeclarationAccepted: true,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        name: 'Marco',
        profileCompletedAt: expect.any(Date),
      }),
    });
    expect(prisma.userRole.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw).toHaveBeenCalledWith(expect.any(Array), 'user-1', '2026-10-17');
    expect(prisma.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: 'user-1', role: Role.GUEST },
      }),
    );
    expect(prisma.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: 'user-1', role: Role.HOST },
      }),
    );
    expect(prisma.providerProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1' },
      update: {},
    });
  });

  it('never updates a phone through the generic profile endpoint', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await service.updateMe('user-1', {
      name: 'Marco',
      phone: '+56911111111',
    } as any);

    const update = prisma.user.update.mock.calls[0][0];
    expect(update.data).not.toHaveProperty('phone');
  });

  it('preserves omitted contact and social fields in a partial PATCH', async () => {
    await service.updateMe('user-1', { contactInfo: { city: ' Santiago ' }, socialAccounts: { websiteUrl: null } });
    const { data } = prisma.user.update.mock.calls[0][0];
    expect(data.contactInfo.upsert.update.city).toBe('Santiago');
    expect(data.contactInfo.upsert.update.address1).toBeUndefined();
    expect(data.contactInfo.upsert.update.latitude).toBeUndefined();
    expect(data.socialAccounts.upsert.update.websiteUrl).toBeNull();
    expect(data.socialAccounts.upsert.update.facebook).toBeUndefined();
  });

  it('allows explicit clearing and zero-valued coordinates', async () => {
    await service.updateMe('user-1', { contactInfo: { address1: '', latitude: 0, longitude: null } });
    const patch = prisma.user.update.mock.calls[0][0].data.contactInfo.upsert.update;
    expect(patch.address1).toBeNull(); expect(patch.latitude).toBe(0); expect(patch.longitude).toBeNull();
  });

  it('rejects whitespace-only onboarding names before any write', async () => {
    await expect(service.completeProfile('user-1', { name: '   ', mode: Role.GUEST })).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not accept identity, role, verification or Stripe fields through profile edits', async () => {
    await service.updateMe('user-1', { name: 'Owner', email: 'other@example.test', roles: ['ADMIN'],
      passwordHash: 'fake', phoneVerified: true, stripeAccountId: 'acct_other', sessionVersion: 0 } as any);
    const data = prisma.user.update.mock.calls[0][0].data;
    for (const field of ['email', 'roles', 'passwordHash', 'phoneVerified', 'stripeAccountId', 'sessionVersion']) expect(data).not.toHaveProperty(field);
    expect(prisma.user.update.mock.calls[0][0].where).toEqual({ id: 'user-1' });
  });

  it('requires an explicit declaration before granting HOST', async () => {
    for (const accepted of [undefined, false, 'true']) {
      await expect(service.completeProfile('user-1', { name: 'Guest', mode: Role.HOST, hostDeclarationAccepted: accepted } as any))
        .rejects.toMatchObject({ response: { code: 'HOST_DECLARATION_REQUIRED' } });
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not request a host declaration or modify phone details for guests', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    await service.completeProfile('user-1', { name: 'Guest', mode: Role.GUEST });
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.providerProfile.upsert).not.toHaveBeenCalled();
    expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty('phoneVerified');
  });
});
