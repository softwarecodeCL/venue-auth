import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UpdateMeDto } from 'src/user/dto/update-me.dto';


const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  domain: '.apartha.com',
  path: '/',
};

@Controller('auth')
export class AuthController {
  environment = process.env.ENV == 'dev' ? false : true;

  
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    const { accessToken, refreshToken } = await this.authService.login(dto);

    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.send({ ok: true });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    return (req as any).user;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  // Fuerza la pipe aquí (para descartar problemas globales)
  @UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }))

  async updateMe(@Req() req: Request, @Body() dto: UpdateMeDto) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    console.log('DTO class =', (dto as any)?.constructor?.name);
    return this.authService.updateProfile(userId, dto as any);
  }


  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response) {
    const rt = (req as any).cookies?.refresh_token;
    const { accessToken, refreshToken } = await this.authService.rotateRefreshToken(rt);

    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.send({ ok: true });
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const rt = (req as any).cookies?.refresh_token;
    await this.authService.revokeRefreshToken(rt);

    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return res.send({ ok: true });
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const { accessToken, refreshToken } = await this.authService.loginWithOAuth((req as any).user);

    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(process.env.FRONTEND_URL as string);
  }

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuth() {}

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookCallback(@Req() req: Request, @Res() res: Response) {
    const { accessToken, refreshToken } = await this.authService.loginWithOAuth((req as any).user);

    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(process.env.FRONTEND_URL as string);
  }
}
