import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { encryptMailToken, queueAccountEmail } from './account-email';

@Injectable()
export class PasswordMailer {
  private readonly logger = new Logger(PasswordMailer.name);

  async enqueue(tx: Prisma.TransactionClient, userId: string, token: string, locale: 'es' | 'en', expiresAt: Date, verification = false) {
    if ((process.env.PASSWORD_MAIL_PROVIDER || 'console') === 'console' && process.env.NODE_ENV !== 'production') {
      // Never print the credential, recipient, or reset URL to application logs.
      this.logger.debug('PASSWORD_RESET_PREVIEW_DISABLED_DELIVERY');
      return;
    }
    await queueAccountEmail(tx, userId, verification ? 'EMAIL_VERIFY' : 'PASSWORD_RESET', `password-reset:${createHash('sha256').update(token).digest('hex')}`, {
      locale, encryptedToken: encryptMailToken(token), expiresAt: expiresAt.toISOString(),
    });
  }
}
