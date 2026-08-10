import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import type { Request } from 'express';

type AuthenticatedRequest = Request & { user: { id: string } };

@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    return this.userService.getMe(req.user.id);
  }

  @Patch('me')
  @HttpCode(200)
  async updateMe(@Req() req: AuthenticatedRequest, @Body() dto: UpdateMeDto) {
    return this.userService.updateMe(req.user.id, dto);
  }

  @Patch('me/onboarding/profile')
  @HttpCode(200)
  async completeProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CompleteProfileDto,
  ) {
    return this.userService.completeProfile(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/edit')
  async getMyEditableProfile(@Req() req: AuthenticatedRequest) {
    // req.user.id viene de tu JwtStrategy.validate()
    return this.userService.getEditableProfile(req.user.id);
  }
}
