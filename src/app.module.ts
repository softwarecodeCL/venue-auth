import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PhoneVerificationModule } from './phone-verification/phone-verification.module';

@Module({
  imports: [PrismaModule, AuthModule, UserModule, PhoneVerificationModule],
})
export class AppModule {}
