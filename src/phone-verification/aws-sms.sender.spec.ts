import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { AwsSmsSender } from './aws-sms.sender';

describe('AwsSmsSender', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AWS_REGION: 'us-east-1',
      AWS_SMS_POOL_ID: 'pool-test',
      AWS_SMS_PROTECT_CONFIGURATION_ID: 'protect-test',
      AWS_SMS_CONFIGURATION_SET: 'APARTHA-OTP',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sends a transactional OTP with trace information', async () => {
    const send = jest.fn().mockResolvedValue({
      MessageId: 'message-test-123',
    });

    const client = {
      send,
    } as unknown as PinpointSMSVoiceV2Client;

    const sender = new AwsSmsSender(client);

    const result = await sender.sendVerificationCode({
      phoneE164: '+56912345678',
      code: '123456',
      expiresInMinutes: 10,
      correlationId: 'challenge-test-123',
    });

    expect(result).toEqual({
      provider: 'aws',
      messageId: 'message-test-123',
    });

    expect(send).toHaveBeenCalledTimes(1);

    const command = send.mock.calls[0][0] as SendTextMessageCommand;

    expect(command).toBeInstanceOf(SendTextMessageCommand);

    expect(command.input).toMatchObject({
      DestinationPhoneNumber: '+56912345678',
      OriginationIdentity: 'pool-test',
      ProtectConfigurationId: 'protect-test',
      ConfigurationSetName: 'APARTHA-OTP',
      MessageType: 'TRANSACTIONAL',
      TimeToLive: 600,
      Context: {
        challengeId: 'challenge-test-123',
      },
    });
  });

  it('requires AWS_REGION', () => {
    delete process.env.AWS_REGION;

    expect(() => new AwsSmsSender()).toThrow(
      'AWS_REGION is required',
    );
  });

  it('requires AWS_SMS_POOL_ID', () => {
    delete process.env.AWS_SMS_POOL_ID;

    expect(() => new AwsSmsSender()).toThrow(
      'AWS_SMS_POOL_ID is required',
    );
  });
});