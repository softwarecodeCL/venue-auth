import { Prisma } from '@prisma/client';
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';

export type AccountEmailKind = 'ACCOUNT_CREATED' | 'HOST_CREATED' | 'PASSWORD_CHANGED' | 'GOOGLE_LINKED' | 'PHONE_VERIFIED' | 'PASSWORD_RESET' | 'EMAIL_VERIFY';

/** Shared DB outbox owned by Web API. Raw SQL keeps auth independent of its generated client. */
export async function queueAccountEmail(tx: Prisma.TransactionClient, userId: string,
  kind: AccountEmailKind, eventKey: string, details: Record<string, unknown> = {}) {
  const user = await tx.user.findUnique({ where: { id: userId },
    select: { email: true, name: true, locale: true, status: true, deletedAt: true } });
  if (!user || user.status !== 'ACTIVE' || user.deletedAt) return;
  const locale = (typeof details.locale === 'string' ? details.locale : user.locale)?.toLowerCase().startsWith('en') ? 'en' : 'es';
  const path = kind === 'HOST_CREATED' ? '/dashboard-my-listings' : kind === 'EMAIL_VERIFY' ? '/verify-email' : kind === 'PASSWORD_RESET' ? '/reset-password' : '/dashboard-my-profile';
  const payload = JSON.stringify({ ...details, kind, locale, name: user.name || undefined,
    path: `${locale === 'en' ? '/en' : ''}${path}` });
  await tx.$executeRaw`
    INSERT INTO "webapi"."EmailOutbox"
      ("id","dedupeKey","notificationId","userId","recipient","payload","updatedAt")
    VALUES (${randomUUID()},${`${eventKey}:user:${userId}`},${eventKey},${userId},${user.email},${payload}::jsonb,NOW())
    ON CONFLICT ("dedupeKey") DO NOTHING
  `;
}

export function encryptMailToken(token: string) {
  const key = Buffer.from(process.env.MAIL_TOKEN_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('MAIL_TOKEN_ENCRYPTION_KEY must be a base64 encoded 32-byte key');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}
