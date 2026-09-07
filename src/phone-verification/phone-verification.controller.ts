import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfirmPhoneCodeDto } from './dto/confirm-phone-code.dto';
import { SendPhoneCodeDto } from './dto/send-phone-code.dto';
import { PhoneVerificationService } from './phone-verification.service';

type AuthenticatedRequest = Request & { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller('users/me/phone-verification')
export class PhoneVerificationController {
  constructor(private readonly service: PhoneVerificationService) {}

  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  send(@Req() request: AuthenticatedRequest, @Body() dto: SendPhoneCodeDto) {
    return this.service.sendCode(request.user.id, dto);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ConfirmPhoneCodeDto,
  ) {
    return this.service.confirmCode(request.user.id, dto);
  }
}
