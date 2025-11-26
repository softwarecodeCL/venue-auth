import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { GoogleStrategy } from './auth/strategies/google.strategy';

@Module({
  imports: [PrismaModule, AuthModule, UserModule],
  providers: [GoogleStrategy],
})
export class AppModule {}
