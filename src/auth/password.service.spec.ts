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
    mailer = { enqueue: jest.fn().mockResolvedValue(undefined) }; service = new PasswordService(prisma, mailer);
  });
  it('does not disclose whether an account exists or uses Google', async () => {
    for (const user of [null, { passwordHash: null }, { passwordHash: 'hash', status: 'SUSPENDED' }]) {
      prisma.user.findUnique.mockResolvedValue(user);
      await expect(service.request('guest@example.com', 'en', '127.0.0.1')).resolves.toEqual({ ok: true });
    }
    expect(mailer.enqueue).not.toHaveBeenCalled();
  });
  it('stores only a hash and emails an unpredictable token', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u', passwordHash: 'hash', status: 'ACTIVE' });
    await service.request('GUEST@example.com', 'en', '127.0.0.1');
    const [tx, userId, token] = mailer.enqueue.mock.calls[0];
    expect(tx).toBe(prisma); expect(userId).toBe('u'); expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.passwordResetToken.create.mock.calls[0][0].data.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
  });
  it('lets an active Google account request a password on its existing identity', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'google-user', passwordHash: null, status: 'ACTIVE', deletedAt: null });
    await expect(service.request('Google@Example.com', 'es', 'ip')).resolves.toEqual({ ok: true });
    expect(mailer.enqueue).toHaveBeenCalledWith(prisma, 'google-user', expect.any(String), 'es', expect.any(Date), false);
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'google-user' }) });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
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
    expect(data.emailVerified).toBe(true);
    expect(data.passwordVerifiedAt).toBeInstanceOf(Date);
    expect(prisma.user.updateMany.mock.calls[0][0].where).toEqual({ id: 'u', status: 'ACTIVE', deletedAt: null });
    expect(data).not.toHaveProperty('phone');
    expect(data).not.toHaveProperty('phoneVerified');
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u', revokedAt: null } }));
  });
  it('rejects a token when its account has since been suspended or deleted', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({ id: 'r', userId: 'u', expiresAt: new Date(Date.now()+60000), usedAt: null });
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.reset('a'.repeat(64), 'long passphrase!', 'ip')).rejects.toThrow(BadRequestException);
    expect(prisma.refreshSession.updateMany).not.toHaveBeenCalled();
  });
  it('requires the old password and rejects bcrypt-truncated Unicode passwords', async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: await hash('current password', 4), passwordVerifiedAt: new Date() });
    await expect(service.change('u', 'wrong', 'new long password')).rejects.toThrow(BadRequestException);
    await expect(service.change('u', 'current password', '🌍'.repeat(30))).rejects.toThrow(BadRequestException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it('limits requests across service instances via the database', async () => {
    prisma.authRateLimit.upsert.mockResolvedValue({ attempts: 31 });
    await expect(service.request('guest@example.com', 'es', 'ip')).rejects.toMatchObject({ status: 429 });
    expect(mailer.enqueue).not.toHaveBeenCalled();
  });
  it('binds new links to the requested email and rejects a later email change', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u', status: 'ACTIVE' });
    await service.request('Owner@Example.com', 'es', 'ip', true);
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({ email: 'owner@example.com' }) });
    expect(mailer.enqueue).toHaveBeenCalledWith(prisma, 'u', expect.any(String), 'es', expect.any(Date), true);
    prisma.passwordResetToken.findUnique.mockResolvedValue({ id: 'r', userId: 'u', email: 'owner@example.com', usedAt: null, expiresAt: new Date(Date.now()+60000) });
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.reset('a'.repeat(64), 'a new passphrase', 'ip')).rejects.toThrow();
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ email: 'owner@example.com' }) }));
    expect(prisma.refreshSession.updateMany).not.toHaveBeenCalled();
  });
});
