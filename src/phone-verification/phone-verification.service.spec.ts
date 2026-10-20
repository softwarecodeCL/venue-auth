/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PhoneVerificationService } from './phone-verification.service';

describe('PhoneVerificationService', () => {
  let prisma: any;
  let sender: { sendVerificationCode: jest.Mock };
  let service: PhoneVerificationService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    process.env.PHONE_DEFAULT_COUNTRY = 'CL';
    process.env.PHONE_ALLOWED_COUNTRIES = 'CL';
    process.env.PHONE_OTP_SECRET = 'test-phone-secret';

    prisma = {
      $executeRaw: jest.fn(),
      $transaction: jest.fn((callback: any) => callback(prisma)),
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      phoneIdentity: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      phoneVerificationChallenge: {
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    sender = { sendVerificationCode: jest.fn() };
    service = new PhoneVerificationService(prisma, sender);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.PHONE_DEFAULT_COUNTRY;
    delete process.env.PHONE_ALLOWED_COUNTRIES;
    delete process.env.PHONE_OTP_SECRET;
  });

  function allowCodeRequest() {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      phone: null,
      phoneVerified: false,
    });
    prisma.phoneIdentity.findUnique.mockResolvedValue(null);
    prisma.phoneVerificationChallenge.findFirst.mockResolvedValue(null);
    prisma.phoneVerificationChallenge.count.mockResolvedValue(0);
    prisma.phoneVerificationChallenge.updateMany.mockResolvedValue({
      count: 0,
    });
    prisma.phoneVerificationChallenge.create.mockResolvedValue({});
    prisma.phoneVerificationChallenge.update.mockResolvedValue({});
    sender.sendVerificationCode.mockResolvedValue({
      provider: 'aws',
      messageId: 'message-test',
    });
  }

  it('normalizes a Chilean phone, hashes the OTP and sends it', async () => {
    allowCodeRequest();

    const response = await service.sendCode('user-1', {
      phone: '9 1234 5678',
    });

    expect(response).toEqual(
      expect.objectContaining({
        verified: false,
        phone: '+56912345678',
        challengeId: expect.any(String),
      }),
    );
    const sms = sender.sendVerificationCode.mock.calls[0][0];
    const created =
      prisma.phoneVerificationChallenge.create.mock.calls[0][0].data;
    expect(sms.code).toMatch(/^\d{6}$/);
    expect(created.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.codeHash).not.toBe(sms.code);
  });

  it('does not skip SMS merely because the editable User row claims verification', async () => {
    allowCodeRequest();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', phone: '+56912345678', phoneVerified: true });
    const result = await service.sendCode('user-1', { phone: '+56912345678' });
    expect(result.verified).toBe(false);
    expect(sender.sendVerificationCode).toHaveBeenCalledTimes(1);
  });

  it('checks phone ownership even when the User row already claims verification', async () => {
    allowCodeRequest();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', phone: '+56912345678', phoneVerified: true });
    prisma.phoneIdentity.findUnique.mockResolvedValue({ userId: 'other-user' });
    await expect(service.sendCode('user-1', { phone: '+56912345678' })).rejects.toThrow(ConflictException);
    expect(sender.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('does not send another code during the cooldown', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      phone: null,
      phoneVerified: false,
    });
    prisma.phoneIdentity.findUnique.mockResolvedValue(null);
    prisma.phoneVerificationChallenge.findFirst.mockResolvedValue({
      resendAfter: new Date(Date.now() + 30_000),
    });

    await expect(
      service.sendCode('user-1', { phone: '+56912345678' }),
    ).rejects.toMatchObject({ status: 429 });
    expect(sender.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('rejects a phone already verified by another user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      phone: null,
      phoneVerified: false,
    });
    prisma.phoneIdentity.findUnique.mockResolvedValue({ userId: 'user-2' });

    await expect(
      service.sendCode('user-1', { phone: '+56912345678' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('invalidates the challenge when SMS delivery fails', async () => {
    allowCodeRequest();
    sender.sendVerificationCode.mockRejectedValue(new Error('SNS unavailable'));

    await expect(
      service.sendCode('user-1', { phone: '+56912345678' }),
    ).rejects.toMatchObject({ status: 503 });
    expect(
      prisma.phoneVerificationChallenge.updateMany,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { invalidatedAt: expect.any(Date) },
      }),
    );
  });

  it('confirms a valid OTP and verifies the user atomically', async () => {
    const id = '65a7204c-65cd-48e1-bd8d-9466a9b35d69';
    const phoneE164 = '+56912345678';
    const code = '123456';
    const codeHash = createHmac('sha256', 'test-phone-secret')
      .update(`${id}:${phoneE164}:${code}`)
      .digest('hex');
    prisma.phoneVerificationChallenge.findFirst.mockResolvedValue({
      id,
      userId: 'user-1',
      phoneE164,
      codeHash,
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      invalidatedAt: null,
    });
    prisma.phoneVerificationChallenge.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.phoneIdentity.findUnique.mockResolvedValue(null);
    prisma.phoneIdentity.upsert.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});

    await expect(
      service.confirmCode('user-1', { challengeId: id, code }),
    ).resolves.toEqual({ verified: true, phone: phoneE164 });
    expect(prisma.phoneIdentity.upsert).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        phone: phoneE164,
        phoneVerified: true,
        phoneVerifiedAt: expect.any(Date),
      },
    });
  });

  it('counts a wrong code without exposing the expected OTP', async () => {
    const id = '65a7204c-65cd-48e1-bd8d-9466a9b35d69';
    const phoneE164 = '+56912345678';
    prisma.phoneVerificationChallenge.findFirst.mockResolvedValue({
      id,
      userId: 'user-1',
      phoneE164,
      codeHash: createHmac('sha256', 'test-phone-secret')
        .update(`${id}:${phoneE164}:123456`)
        .digest('hex'),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      invalidatedAt: null,
    });
    prisma.phoneVerificationChallenge.updateMany.mockResolvedValue({
      count: 1,
    });

    await expect(
      service.confirmCode('user-1', {
        challengeId: id,
        code: '654321',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.phoneVerificationChallenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { attempts: { increment: 1 } },
      }),
    );
  });
});
