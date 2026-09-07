import { Logger } from '@nestjs/common';
import type {
  SendVerificationSms,
  SendVerificationSmsResult,
  SmsSender,
} from './sms-sender';

export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger(ConsoleSmsSender.name);

  async sendVerificationCode({
    phoneE164,
    code,
    expiresInMinutes,
  }: SendVerificationSms): Promise<SendVerificationSmsResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'The console SMS provider cannot run in production',
      );
    }

    this.logger.warn(
      `[LOCAL SMS] ${phoneE164} -> ${code} (${expiresInMinutes} min)`,
    );

    return {
      provider: 'console',
      messageId: null,
    };
  }
}
