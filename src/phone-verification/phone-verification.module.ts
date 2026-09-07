import { Module } from '@nestjs/common';
import { AwsSmsSender } from './aws-sms.sender';
import { ConsoleSmsSender } from './console-sms.sender';
import { PhoneVerificationController } from './phone-verification.controller';
import { PhoneVerificationService } from './phone-verification.service';
import { SMS_SENDER } from './sms-sender';

@Module({
  controllers: [PhoneVerificationController],
  providers: [
    PhoneVerificationService,
    {
      provide: SMS_SENDER,
      useFactory: () => {
        const configured =
          process.env.SMS_PROVIDER?.trim().toLowerCase();

        const provider =
          configured ||
          (process.env.NODE_ENV === 'production'
            ? 'aws'
            : 'console');

        if (provider === 'aws') {
          return new AwsSmsSender();
        }

        if (provider === 'console') {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'SMS_PROVIDER=console is forbidden in production',
            );
          }

          return new ConsoleSmsSender();
        }

        throw new Error(
          `Unsupported SMS_PROVIDER: ${provider}`,
        );
      },
    },
  ],
})
export class PhoneVerificationModule {}