export const SMS_SENDER = Symbol('SMS_SENDER');

export type SendVerificationSms = {
  phoneE164: string;
  code: string;
  expiresInMinutes: number;
  correlationId: string;
};

export type SendVerificationSmsResult = {
  provider: 'console' | 'aws';
  messageId: string | null;
};

export interface SmsSender {
  sendVerificationCode(
    message: SendVerificationSms,
  ): Promise<SendVerificationSmsResult>;
}