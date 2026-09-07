import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { UserService } from '../user/user.service';
import { UpdateMeDto } from '../user/dto/update-me.dto';
import { authCookieOptions } from './auth-cookies';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  GoogleOAuthCallbackGuard,
  GoogleOAuthStartGuard,
} from './guards/google-oauth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

type SessionUser = Awaited<ReturnType<AuthService['getAuthenticatedUser']>>;
type AuthenticatedRequest = Request & { user: SessionUser };
type GoogleProfile = Parameters<AuthService['loginWithOAuth']>[0];
type GoogleCallbackRequest = Request & { user: GoogleProfile };

function cookie(request: Request, name: string): string | undefined {
  const cookies = (request as unknown as { cookies?: Record<string, unknown> })
    .cookies;
  const value = cookies?.[name];
  return typeof value === 'string' ? value : undefined;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res() response: Response) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);
    this.setSessionCookies(response, accessToken, refreshToken);
    return response.send({ ok: true, user });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  // Backwards-compatible alias. New clients should use PATCH /users/me.
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Req() request: AuthenticatedRequest, @Body() dto: UpdateMeDto) {
    return this.userService.updateMe(request.user.id, dto);
  }

  @Post('refresh')
  async refresh(@Req() request: Request, @Res() response: Response) {
    const token = cookie(request, 'refresh_token');
    const { accessToken, refreshToken } =
      await this.authService.rotateRefreshToken(token);

    this.setSessionCookies(response, accessToken, refreshToken);
    return response.send({ ok: true });
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res() response: Response) {
    try {
      await this.authService.revokeRefreshToken(
        cookie(request, 'refresh_token'),
      );
    } catch {
      // Logout must be idempotent and never fail the client session cleanup.
    }

    const options = authCookieOptions();
    response.clearCookie('access_token', options);
    response.clearCookie('refresh_token', options);
    return response.send({ ok: true });
  }

  @Get('google')
  @UseGuards(GoogleOAuthStartGuard)
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(GoogleOAuthCallbackGuard)
  async googleAuthRedirect(
    @Req() request: GoogleCallbackRequest,
    @Res() response: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.loginWithOAuth(request.user);

    this.setSessionCookies(response, accessToken, refreshToken);

    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const destination = user.onboarding.profileCompleted
      ? frontendUrl
      : `${frontendUrl}/onboarding`;

    return response.redirect(destination);
  }

  private setSessionCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const options = authCookieOptions();
    response.cookie('access_token', accessToken, {
      ...options,
      maxAge: 50 * 60 * 1_000,
    });
    response.cookie('refresh_token', refreshToken, {
      ...options,
      maxAge: 30 * 24 * 60 * 60 * 1_000,
    });
  }
}
