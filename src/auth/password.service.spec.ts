import { BadRequestException } from '@nestjs/common';
import { hash, compare } from 'bcrypt';
import { createHash } from 'node:crypto';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let prisma: any, mailer: any, service: PasswordService;
  beforeEach(() => {
    prisma = {
      authRateLimit: { upsert: jest.fn().mockResolvedValue({ attempts: 1 }), deleteMany: jest.fn() },
      user: { findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      passwordResetToken: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn() },
      refreshSession: { updateMany: jest.fn() }, $executeRaw: jest.fn(),
    };
    prisma.$transaction = jest.fn((fn: any) => fn(prisma));
    mailer = { send: jest.fn().mockResolvedValue(undefined) }; service = new PasswordService(prisma, mailer);
  });
  it('does not disclose whether an account exists or uses Google', async () => {
    for (const user of [null, { passwordHash: null }, { passwordHash: 'hash', status: 'SUSPENDED' }]) {
      prisma.user.findUnique.mockResolvedValue(user);
      await expect(service.request('guest@example.com', 'en', '127.0.0.1')).resolves.toEqual({ ok: true });
    }
    expect(mailer.send).not.toHaveBeenCalled();
  });
  it('stores only a hash and emails an unpredictable token', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u', passwordHash: 'hash', status: 'ACTIVE' });
    await service.request('GUEST@example.com', 'en', '127.0.0.1');
    const [email, token] = mailer.send.mock.calls[0];
    expect(email).toBe('guest@example.com'); expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.passwordResetToken.create.mock.calls[0][0].data.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
  });
  it('rejects expired, consumed and concurrently consumed tokens without changing a password', async () => {
    for (const token of [null, { usedAt: new Date() }, { expiresAt: new Date(0) }]) {
      prisma.passwordResetToken.findUnique.mockResolvedValue(token);
      await expect(service.reset('a'.repeat(64), 'long passphrase!', 'ip')).rejects.toThrow(BadRequestException);
    }
    prisma.passwordResetToken.findUnique.mockResolvedValue({ id: 'r', userId: 'u', expiresAt: new Date(Date.now()+60000), usedAt: null });
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.reset('a'.repeat(64), 'long passphrase!', 'ip')).rejects.toThrow(BadRequestException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it('updates the password and revokes all refresh/access sessions together', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({ id: 'r', userId: 'u', expiresAt: new Date(Date.now()+60000), usedAt: null });
    await service.reset('a'.repeat(64), 'long passphrase!', 'ip');
    const data = prisma.user.updateMany.mock.calls[0][0].data;
    expect(await compare('long passphrase!', data.passwordHash)).toBe(true);
    expect(data.sessionVersion).toEqual({ increment: 1 });
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u', revokedAt: null } }));
  });
  it('requires the old password and rejects bcrypt-truncated Unicode passwords', async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: await hash('current password', 4) });
    await expect(service.change('u', 'wrong', 'new long password')).rejects.toThrow(BadRequestException);
    await expect(service.change('u', 'current password', '🌍'.repeat(30))).rejects.toThrow(BadRequestException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it('limits requests across service instances via the database', async () => {
    prisma.authRateLimit.upsert.mockResolvedValue({ attempts: 31 });
    await expect(service.request('guest@example.com', 'es', 'ip')).rejects.toMatchObject({ status: 429 });
    expect(mailer.send).not.toHaveBeenCalled();
  });
});
