/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Role } from '@prisma/client';
import { UserService } from './user.service';

describe('UserService', () => {
  let prisma: any;
  let service: UserService;

  beforeEach(() => {
    prisma = {
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
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        name: 'Marco',
        profileCompletedAt: expect.any(Date),
      }),
    });
    expect(prisma.userRole.upsert).toHaveBeenCalledTimes(2);
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
});
