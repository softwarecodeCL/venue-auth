import { queueAccountEmail } from '../auth/account-email';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmPhoneCodeDto } from './dto/confirm-phone-code.dto';
import { SendPhoneCodeDto } from './dto/send-phone-code.dto';
import { SMS_SENDER } from './sms-sender';
import type { SmsSender } from './sms-sender';

const OTP_DIGITS = 6;
const DEFAULT_EXPIRY_MINUTES = 10;
const DEFAULT_RESEND_SECONDS = 60;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_SENDS_PER_HOUR = 5;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function secondsBetween(future: Date, now: Date): number {
  return Math.max(1, Math.ceil((future.getTime() - now.getTime()) / 1_000));
}

@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
  ) {}

  async sendCode(userId: string, dto: SendPhoneCodeDto) {
    const phoneE164 = this.normalizePhone(dto.phone);
    const now = new Date();
    const expiryMinutes = positiveInteger(
      process.env.PHONE_OTP_EXPIRES_MINUTES,
      DEFAULT_EXPIRY_MINUTES,
    );
    const resendSeconds = positiveInteger(
      process.env.PHONE_OTP_RESEND_SECONDS,
      DEFAULT_RESEND_SECONDS,
    );
    const maxAttempts = positiveInteger(
      process.env.PHONE_OTP_MAX_ATTEMPTS,
      DEFAULT_MAX_ATTEMPTS,
    );
    const sendsPerHour = positiveInteger(
      process.env.PHONE_OTP_SENDS_PER_HOUR,
      DEFAULT_SENDS_PER_HOUR,
    );
    const challengeId = randomUUID();
    const code = randomInt(0, 10 ** OTP_DIGITS)
      .toString()
      .padStart(OTP_DIGITS, '0');
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60_000);
    const resendAfter = new Date(now.getTime() + resendSeconds * 1_000);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phone-otp:${userId}`}))`;

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true, phoneVerified: true },
      });
      if (!user) throw new NotFoundException('Usuario no encontrado');

      const owner = await tx.phoneIdentity.findUnique({
        where: { phoneE164 },
        select: { userId: true },
      });
      if (owner && owner.userId !== userId) {
        throw new ConflictException(
          'Este teléfono ya está asociado a otra cuenta',
        );
      }

      if (user.phoneVerified && user.phone === phoneE164 && owner?.userId === userId) {
        return { alreadyVerified: true as const };
      }

      const active = await tx.phoneVerificationChallenge.findFirst({
        where: {
          userId,
          consumedAt: null,
          invalidatedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
        select: { resendAfter: true },
      });

      if (active && active.resendAfter > now) {
        this.tooManyRequests(
          'Debes esperar antes de solicitar otro código',
          secondsBetween(active.resendAfter, now),
        );
      }

      const since = new Date(now.getTime() - 60 * 60_000);
      const [userSends, phoneSends] = await Promise.all([
        tx.phoneVerificationChallenge.count({
          where: { userId, sentAt: { not: null }, createdAt: { gte: since } },
        }),
        tx.phoneVerificationChallenge.count({
          where: {
            phoneE164,
            sentAt: { not: null },
            createdAt: { gte: since },
          },
        }),
      ]);

      if (userSends >= sendsPerHour || phoneSends >= sendsPerHour) {
        this.tooManyRequests(
          'Alcanzaste el límite de códigos. Inténtalo más tarde',
          60 * 60,
        );
      }

      await tx.phoneVerificationChallenge.updateMany({
        where: { userId, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      });

      await tx.phoneVerificationChallenge.create({
        data: {
          id: challengeId,
          userId,
          phoneE164,
          codeHash: this.hashCode(challengeId, phoneE164, code),
          maxAttempts,
          expiresAt,
          resendAfter,
        },
      });

      return { alreadyVerified: false as const };
    });

    if (result.alreadyVerified) {
      return {
        verified: true,
        phone: phoneE164,
      };
    }

    try {
      const delivery =
        await this.smsSender.sendVerificationCode({
          phoneE164,
          code,
          expiresInMinutes: expiryMinutes,
          correlationId: challengeId,
        });

      await this.prisma.phoneVerificationChallenge.update({
        where: { id: challengeId },
        data: { sentAt: new Date() },
      });

      this.logger.log(
        [
          'OTP SMS accepted',
          `challengeId=${challengeId}`,
          `provider=${delivery.provider}`,
          `messageId=${delivery.messageId ?? 'local'}`,
        ].join(' | '),
      );
    } catch (error) {

        await this.prisma.phoneVerificationChallenge
          .updateMany({
            where: {
              id: challengeId,
              consumedAt: null,
            },
            data: {
              invalidatedAt: new Date(),
            },
          })
          .catch(() => undefined);

        const awsError = error as {
          name?: string;
          message?: string;
          stack?: string;
          $metadata?: {
            httpStatusCode?: number;
            requestId?: string;
          };
        };

        this.logger.error(
          [
            `SMS delivery failed for challenge ${challengeId}`,
            `type=${awsError.name ?? 'UnknownError'}`,
            `message=${awsError.message ?? String(error)}`,
            `status=${awsError.$metadata?.httpStatusCode ?? 'unknown'}`,
            `requestId=${awsError.$metadata?.requestId ?? 'unknown'}`,
          ].join(' | '),
          awsError.stack,
        );

        throw new ServiceUnavailableException(
          'No pudimos enviar el SMS. Inténtalo nuevamente',
        );
      }

    return {
      verified: false,
      challengeId,
      phone: phoneE164,
      expiresInSeconds: expiryMinutes * 60,
      resendAfterSeconds: resendSeconds,
    };
  }

  async confirmCode(userId: string, dto: ConfirmPhoneCodeDto) {
    const now = new Date();
    const challenge = await this.prisma.phoneVerificationChallenge.findFirst({
      where: { id: dto.challengeId, userId },
    });

    if (!challenge) throw new BadRequestException('Código inválido o vencido');

    if (challenge.consumedAt) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true, phoneVerified: true },
      });
      if (user?.phoneVerified && user.phone === challenge.phoneE164) {
        return { verified: true, phone: user.phone };
      }
      throw new BadRequestException('Código inválido o vencido');
    }

    this.assertChallengeUsable(challenge, now);

    const expected = Buffer.from(challenge.codeHash, 'hex');
    const received = Buffer.from(
      this.hashCode(challenge.id, challenge.phoneE164, dto.code),
      'hex',
    );
    const matches =
      expected.length === received.length &&
      timingSafeEqual(expected, received);

    if (!matches) {
      const nextAttempts = challenge.attempts + 1;
      await this.prisma.phoneVerificationChallenge.updateMany({
        where: {
          id: challenge.id,
          userId,
          attempts: challenge.attempts,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: {
          attempts: { increment: 1 },
          ...(nextAttempts >= challenge.maxAttempts
            ? { invalidatedAt: now }
            : {}),
        },
      });

      if (nextAttempts >= challenge.maxAttempts) {
        this.tooManyRequests(
          'Código bloqueado por demasiados intentos. Solicita uno nuevo',
          60,
        );
      }
      throw new BadRequestException('El código ingresado no es correcto');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phone-otp:${userId}`}))`;

        const consumed = await tx.phoneVerificationChallenge.updateMany({
          where: {
            id: challenge.id,
            userId,
            consumedAt: null,
            invalidatedAt: null,
            expiresAt: { gt: now },
            attempts: { lt: challenge.maxAttempts },
          },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) {
          throw new BadRequestException('Código inválido o vencido');
        }

        const owner = await tx.phoneIdentity.findUnique({
          where: { phoneE164: challenge.phoneE164 },
          select: { userId: true },
        });
        if (owner && owner.userId !== userId) {
          throw new ConflictException(
            'Este teléfono ya está asociado a otra cuenta',
          );
        }

        await tx.phoneIdentity.upsert({
          where: { userId },
          create: {
            userId,
            phoneE164: challenge.phoneE164,
            verifiedAt: now,
          },
          update: { phoneE164: challenge.phoneE164, verifiedAt: now },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            phone: challenge.phoneE164,
            phoneVerified: true,
            phoneVerifiedAt: now,
          },
        });

        await queueAccountEmail(tx, userId, 'PHONE_VERIFIED', `phone-verified:${challenge.id}`);
        await tx.phoneVerificationChallenge.updateMany({
          where: {
            userId,
            id: { not: challenge.id },
            consumedAt: null,
            invalidatedAt: null,
          },
          data: { invalidatedAt: now },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Este teléfono ya está asociado a otra cuenta',
        );
      }
      throw error;
    }

    return { verified: true, phone: challenge.phoneE164 };
  }

  private normalizePhone(raw: string): string {
    const defaultCountry =
      (process.env.PHONE_DEFAULT_COUNTRY?.trim().toUpperCase() ||
        'CL') as CountryCode;
    const parsed = parsePhoneNumberFromString(raw.trim(), defaultCountry);

    if (!parsed?.isValid()) {
      throw new BadRequestException('Ingresa un número telefónico válido');
    }

    const allowed = (process.env.PHONE_ALLOWED_COUNTRIES || '')
      .split(',')
      .map((country) => country.trim().toUpperCase())
      .filter(Boolean);
    if (
      allowed.length &&
      (!parsed.country || !allowed.includes(parsed.country))
    ) {
      throw new BadRequestException(
        'El país de este teléfono no está habilitado',
      );
    }

    return parsed.number;
  }

  private assertChallengeUsable(
    challenge: {
      invalidatedAt: Date | null;
      expiresAt: Date;
      attempts: number;
      maxAttempts: number;
    },
    now: Date,
  ) {
    if (challenge.invalidatedAt || challenge.expiresAt <= now) {
      throw new BadRequestException('Código inválido o vencido');
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      this.tooManyRequests(
        'Código bloqueado por demasiados intentos. Solicita uno nuevo',
        60,
      );
    }
  }

  private hashCode(challengeId: string, phoneE164: string, code: string) {
    return createHmac('sha256', this.otpSecret())
      .update(`${challengeId}:${phoneE164}:${code}`)
      .digest('hex');
  }

  private otpSecret() {
    const configured = process.env.PHONE_OTP_SECRET?.trim();
    if (configured) return configured;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PHONE_OTP_SECRET is required in production');
    }
    return (
      process.env.JWT_REFRESH_SECRET ||
      process.env.JWT_SECRET ||
      'local-development-phone-otp-secret'
    );
  }

  private tooManyRequests(message: string, retryAfterSeconds: number): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message,
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
