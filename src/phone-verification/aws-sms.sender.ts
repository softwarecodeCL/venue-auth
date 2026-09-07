import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from '@aws-sdk/client-pinpoint-sms-voice-v2';
import type {
  SendVerificationSms,
  SendVerificationSmsResult,
  SmsSender,
} from './sms-sender';

export class AwsSmsSender implements SmsSender {
  private readonly client: PinpointSMSVoiceV2Client;
  private readonly poolId: string;
  private readonly protectConfigurationId?: string;
  private readonly configurationSetName?: string;

  constructor(client?: PinpointSMSVoiceV2Client) {
    const region = process.env.AWS_REGION?.trim();
    const poolId = process.env.AWS_SMS_POOL_ID?.trim();

    if (!region) {
      throw new Error('AWS_REGION is required');
    }

    if (!poolId) {
      throw new Error('AWS_SMS_POOL_ID is required');
    }

    this.poolId = poolId;
    this.protectConfigurationId =
      process.env.AWS_SMS_PROTECT_CONFIGURATION_ID?.trim();

    this.configurationSetName =
      process.env.AWS_SMS_CONFIGURATION_SET?.trim();

    this.client =
      client ??
      new PinpointSMSVoiceV2Client({
        region,
      });
  }

  async sendVerificationCode({
    phoneE164,
    code,
    expiresInMinutes,
    correlationId,
  }: SendVerificationSms): Promise<SendVerificationSmsResult> {
    const response = await this.client.send(
      new SendTextMessageCommand({
        DestinationPhoneNumber: phoneE164,
        OriginationIdentity: this.poolId,
        ProtectConfigurationId:
          this.protectConfigurationId,
        ConfigurationSetName:
          this.configurationSetName,
        MessageType: 'TRANSACTIONAL',
        TimeToLive: Math.min(
          Math.max(expiresInMinutes * 60, 5),
          259200,
        ),
        MessageBody:
          `Apartha: tu codigo es ${code}. ` +
          `Vence en ${expiresInMinutes} minutos. No lo compartas.`,
        Context: {
          challengeId: correlationId,
        },
      }),
    );

    return {
      provider: 'aws',
      messageId: response.MessageId ?? null,
    };
  }
}