import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UseFilters,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { UserService } from '../user/user.service';
import { UpdateMeDto } from '../user/dto/update-me.dto';
import { JwtService } from '@nestjs/jwt';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { GOOGLE_LINK_COOKIE, readGoogleLink } from './google-link';
import { OAuthExceptionFilter } from './oauth-exception.filter';
import { PasswordService } from './password.service';
import { ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './dto/password.dto';
import { authCookieOptions, oauthStateCookieOptions } from './auth-cookies';
import { GOOGLE_RETURN_COOKIE, safeFrontendPath } from './auth-redirect';
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

class GoogleLinkDto {
  @IsString() @MinLength(1) @MaxLength(256) currentPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly passwords: PasswordService,
  ) {}

  @Post('password/forgot')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.passwords.request(dto.email, dto.locale || 'es', req.ip || req.socket.remoteAddress || 'unknown');
  }

  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.passwords.reset(dto.token, dto.password, req.ip || req.socket.remoteAddress || 'unknown');
  }

  @Post('password/change')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.passwords.change(req.user.id, dto.currentPassword, dto.password);
    res.clearCookie('access_token', authCookieOptions());
    res.clearCookie('refresh_token', authCookieOptions());
    return result;
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    await this.passwords.limit(`register-ip:${req.ip || req.socket.remoteAddress || 'unknown'}`, 10, 3600);
    await this.passwords.limit(`register-email:${dto.email.trim().toLowerCase()}`, 3, 3600);
    await this.authService.register(dto);
    await this.passwords.request(dto.email, dto.locale || 'es', req.ip || req.socket.remoteAddress || 'unknown', true);
    return { ok: true, verificationRequired: true };
  }

  @Post('email/verification')
  verifyEmail(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.passwords.request(dto.email, dto.locale || 'es', req.ip || req.socket.remoteAddress || 'unknown', true);
  }

  @Post('google/link')
  @UseGuards(JwtAuthGuard)
  async linkGoogle(@Body() dto: GoogleLinkDto, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    await this.passwords.limit(`google-link:${req.user.id}`, 5, 900);
    const intent = await this.authService.googleLinkIntent(req.user.id, dto.currentPassword);
    res.cookie(GOOGLE_LINK_COOKIE, intent, { ...oauthStateCookieOptions(), maxAge: 5 * 60_000 });
    return { ok: true };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const email = dto.email.trim().toLowerCase();
    try {
      await this.passwords.limit(`login-ip:${ip}`, 30, 900);
      await this.passwords.limit(`login-pair:${ip}:${email}`, 5, 60);
      await this.passwords.limit(`login-account:${email}`, 20, 900);
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 429) {
        const body = error.getResponse() as { retryAfterSeconds?: number };
        response.setHeader('Retry-After', String(body.retryAfterSeconds || 60));
      }
      throw error;
    }
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);
    this.setSessionCookies(response, accessToken, refreshToken);
    return { ok: true, user };
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
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = cookie(request, 'refresh_token');
    const { accessToken, refreshToken } =
      await this.authService.rotateRefreshToken(token);

    this.setSessionCookies(response, accessToken, refreshToken);
    return { ok: true };
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
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
    return { ok: true };
  }

  @Get('google')
  @UseFilters(OAuthExceptionFilter)
  @UseGuards(GoogleOAuthStartGuard)
  googleAuth() {}

  @Get('google/callback')
  @UseFilters(OAuthExceptionFilter)
  @UseGuards(GoogleOAuthCallbackGuard)
  async googleAuthRedirect(
    @Req() request: GoogleCallbackRequest,
    @Res() response: Response,
  ) {
    const rawLink = cookie(request, GOOGLE_LINK_COOKIE);
    const link = rawLink ? readGoogleLink(new JwtService(), rawLink) : undefined;
    if (link && link.state !== request.query.state) throw new HttpException({ code: 'GOOGLE_LINK_EXPIRED' }, 401);
    response.clearCookie(GOOGLE_LINK_COOKIE, oauthStateCookieOptions());
    const { accessToken, refreshToken, user } =
      await this.authService.loginWithOAuth(request.user, link);

    this.setSessionCookies(response, accessToken, refreshToken);

    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const returnTo = safeFrontendPath(cookie(request, GOOGLE_RETURN_COOKIE));
    response.clearCookie(GOOGLE_RETURN_COOKIE, oauthStateCookieOptions());
    const prefix = /^\/(en|es)(?:\/|$)/.exec(returnTo)?.[0].replace(/\/$/, '') ?? '';
    const step = !user.onboarding.profileCompleted ? '/onboarding'
      : !user.phoneVerified ? '/verify-phone' : null;
    const destination = new URL(step ? `${prefix}${step}` : returnTo, `${frontendUrl}/`);
    if (step) destination.searchParams.set('redirect', returnTo);
    response.redirect(destination.toString());
  }

  private setSessionCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const options = authCookieOptions();
    const maxAge = this.authService.sessionCookieMaxAge();
    response.cookie('access_token', accessToken, {
      ...options,
      maxAge: maxAge.access,
    });
    response.cookie('refresh_token', refreshToken, {
      ...options,
      maxAge: maxAge.refresh,
    });
  }
}
