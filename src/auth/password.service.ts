import { BadRequestException, HttpException, Injectable, Logger } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordMailer } from './password-mailer';
import { queueAccountEmail } from './account-email';
import { assertNewPassword } from './password-policy';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const invalid = () => new BadRequestException({ code: 'PASSWORD_LINK_INVALID' });

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  constructor(private readonly prisma: PrismaService, private readonly mailer: PasswordMailer) {}

  // Database counters work across processes; no client-controlled forwarded IP headers.
  async limit(key: string, maximum: number, seconds: number) {
    const now = new Date();
    const bucket = `${digest(key)}:${Math.floor(now.getTime() / (seconds * 1000))}`;
    const row = await this.prisma.authRateLimit.upsert({
      where: { key: bucket }, update: { attempts: { increment: 1 } },
      create: { key: bucket, attempts: 1, expiresAt: new Date(now.getTime() + seconds * 1000) },
    });
    await this.prisma.authRateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
    if (row.attempts > maximum) throw new HttpException({ code: 'ACCOUNT_RATE_LIMIT', retryAfterSeconds: Math.max(1, seconds - Math.floor(now.getTime() / 1000) % seconds) }, 429);
  }

  async request(email: string, locale: 'es' | 'en', ip: string, verification = false) {
    await this.limit(`reset-ip:${ip}`, 30, 3600);
    const normalized = email.trim().toLowerCase();
    // Same response for missing users, Google accounts, inactive accounts and repeated requests.
    try { await this.limit(`reset-email:${normalized}`, 3, 3600); }
    catch (error) { if (error instanceof HttpException && error.getStatus() === 429) return { ok: true }; throw error; }
    const user = await this.prisma.user.findUnique({ where: { email: normalized }, select: { id: true, passwordHash: true, status: true, deletedAt: true } });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) return { ok: true };
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 20 * 60000);
    try {
      await this.prisma.$transaction(async tx => {
        await tx.passwordResetToken.create({ data: { userId: user.id, email: normalized, tokenHash: digest(token), expiresAt } });
        await this.mailer.enqueue(tx, user.id, token, locale, expiresAt, verification);
      });
    } catch {
      // Same public response; failures are observable without revealing the account.
      this.logger.error('PASSWORD_RESET_QUEUE_FAILED');
    }
    await this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return { ok: true };
  }

  async reset(token: string, password: string, ip: string) {
    await this.limit(`reset-confirm:${ip}`, 30, 900);
    this.validatePassword(password);
    const reset = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: digest(token) } });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw invalid();
    const passwordHash = await hash(password, 12);
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`password:${reset.userId}`}))`;
      const now = new Date();
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: reset.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (claimed.count !== 1) throw invalid();
      const before = await tx.user.findUnique({ where: { id: reset.userId }, select: { emailVerified: true } });
      // Possession of the one-use email token also lets a Google user add a
      // password to the SAME account, preserving its phone, roles and bookings.
      const updated = await tx.user.updateMany({ where: { id: reset.userId, status: 'ACTIVE', deletedAt: null, ...(reset.email ? { email: reset.email } : {}) }, data: { passwordHash, passwordVerifiedAt: now, emailVerified: true, sessionVersion: { increment: 1 } } });
      if (updated.count !== 1) throw invalid();
      await tx.refreshSession.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.passwordResetToken.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: now } });
      if (before?.emailVerified === false) await queueAccountEmail(tx, reset.userId, 'ACCOUNT_CREATED', `account-created:${reset.userId}`);
      await queueAccountEmail(tx, reset.userId, 'PASSWORD_CHANGED', `password-reset-completed:${reset.id}`);
    });
    return { ok: true };
  }

  async change(userId: string, currentPassword: string, password: string) {
    await this.limit(`password-change:${userId}`, 5, 900);
    this.validatePassword(password);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, passwordVerifiedAt: true } });
    if (!user?.passwordHash || !user.passwordVerifiedAt) throw new BadRequestException({ code: 'PASSWORD_GOOGLE_ACCOUNT' });
    if (!await compare(currentPassword, user.passwordHash)) throw new BadRequestException({ code: 'PASSWORD_CURRENT_INVALID' });
    if (await compare(password, user.passwordHash)) throw new BadRequestException({ code: 'PASSWORD_UNCHANGED' });
    const passwordHash = await hash(password, 12);
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`password:${userId}`}))`;
      const updated = await tx.user.updateMany({ where: { id: userId, passwordHash: user.passwordHash, status: 'ACTIVE', deletedAt: null }, data: { passwordHash, sessionVersion: { increment: 1 } } });
      if (updated.count !== 1) throw new BadRequestException({ code: 'PASSWORD_CURRENT_INVALID' });
      const now = new Date();
      await tx.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
      await queueAccountEmail(tx, userId, 'PASSWORD_CHANGED', `password-changed:${randomUUID()}`);
    });
    return { ok: true };
  }

  private validatePassword(password: string) {
    assertNewPassword(password);
  }
}
