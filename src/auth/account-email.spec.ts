import { createDecipheriv } from 'node:crypto';
import { encryptMailToken, queueAccountEmail } from './account-email';
import { PasswordMailer } from './password-mailer';

describe('Durable account emails', () => {
  const env = { ...process.env };
  let tx: any;
  beforeEach(() => {
    process.env.MAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    tx = { user: { findUnique: jest.fn().mockResolvedValue({ email: 'guest@example.com', name: 'Guest', locale: 'en-US', status: 'ACTIVE' }) }, $executeRaw: jest.fn() };
  });
  afterAll(() => { process.env = env; });
  it('uses the transaction and a stable unique event key without interpolating SQL', async () => {
    await queueAccountEmail(tx, 'u', 'HOST_CREATED', 'host-created:u');
    const args = tx.$executeRaw.mock.calls[0];
    expect(args[0].join('?')).toContain('ON CONFLICT ("dedupeKey") DO NOTHING');
    expect(args).toContain('host-created:u:user:u');
    const payload = JSON.parse(args.at(-1));
    expect(payload).toMatchObject({ kind: 'HOST_CREATED', locale: 'en', path: '/en/dashboard-my-listings' });
  });
  it('does not enqueue for suspended or deleted users', async () => {
    tx.user.findUnique.mockResolvedValue({ status: 'SUSPENDED' });
    await queueAccountEmail(tx, 'u', 'HOST_CREATED', 'key');
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
  it('encrypts reset tokens with authenticated encryption and random IVs', () => {
    const token = 'a'.repeat(64), value = encryptMailToken(token);
    expect(value).not.toContain(token);
    expect(encryptMailToken(token)).not.toBe(value);
    const [version, iv, tag, ciphertext] = value.split('.');
    expect(version).toBe('v1');
    const cipher = createDecipheriv('aes-256-gcm', Buffer.alloc(32, 7), Buffer.from(iv, 'base64url'));
    cipher.setAuthTag(Buffer.from(tag, 'base64url'));
    expect(Buffer.concat([cipher.update(Buffer.from(ciphertext, 'base64url')), cipher.final()]).toString()).toBe(token);
  });
  it('queues recovery with an expiry and never persists a plaintext token', async () => {
    process.env.PASSWORD_MAIL_PROVIDER = 'smtp';
    await new PasswordMailer().enqueue(tx, 'u', 'a'.repeat(64), 'es', new Date(Date.now()+1200000));
    const payload = JSON.parse(tx.$executeRaw.mock.calls[0].at(-1));
    expect(payload).toMatchObject({ kind: 'PASSWORD_RESET', locale: 'es', path: '/reset-password' });
    expect(payload).not.toHaveProperty('token');
    expect(payload.encryptedToken).toMatch(/^v1\./);
    expect(payload.expiresAt).toBeTruthy();
  });
  it('fails closed with a missing encryption key', () => {
    delete process.env.MAIL_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptMailToken('a'.repeat(64))).toThrow('MAIL_TOKEN_ENCRYPTION_KEY');
  });
});
