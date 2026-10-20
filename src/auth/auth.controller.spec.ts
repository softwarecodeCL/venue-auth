import { Test } from '@nestjs/testing';
import { UserService } from '../user/user.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { browserMutationGuard } from '../config/browser-security';
import { HttpException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: PasswordService, useValue: { limit: jest.fn(), request: jest.fn() } },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('returns the authenticated request user from /auth/me', () => {
    const user = { id: 'user-1', roles: ['GUEST'] };
    const request = { user } as unknown as Parameters<AuthController['me']>[0];
    expect(controller.me(request)).toBe(user);
  });
  it('limits welcome-email creation before registering, with the trusted request IP and normalized email', async () => {
    const register = jest.fn().mockResolvedValue({ id: 'u' });
    const limit = jest.fn().mockResolvedValue(undefined);
    const guarded = new AuthController({ register } as any, {} as any, { limit, request: jest.fn() } as any);
    const dto = { email: 'User@Example.com', password: 'test-only-password', name: 'Guest' };
    const req = { ip: '127.0.0.1', headers: { 'x-forwarded-for': 'spoofed' } } as any;
    await guarded.register(dto, req);
    expect(limit.mock.calls).toEqual([['register-ip:127.0.0.1', 10, 3600], ['register-email:user@example.com', 3, 3600]]);
    expect(register).toHaveBeenCalledTimes(1);
    register.mockClear(); limit.mockRejectedValue(new HttpException({ code: 'ACCOUNT_RATE_LIMIT' }, 429));
    await expect(guarded.register(dto, req)).rejects.toMatchObject({ status: 429 });
    expect(register).not.toHaveBeenCalled();
  });
});

describe('Auth HTTP session endpoints', () => {
  let app: INestApplication;
  const exceptions: unknown[] = [];
  const auth = {
    revokeRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    login: jest.fn(),
    sessionCookieMaxAge: () => ({ access: 60_000, refresh: 3_600_000 }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: UserService, useValue: {} },
        { provide: PasswordService, useValue: { limit: jest.fn(), request: jest.fn() } },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: any) => {
      context.switchToHttp().getRequest().user = { id: 'user-1' };
      return true;
    } }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.use(browserMutationGuard(['http://localhost:3000']));
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
    app.useGlobalFilters({ catch(exception, host) {
      exceptions.push(exception);
      const response = host.switchToHttp().getResponse();
      if (!response.headersSent) response.status(500).json({ error: 'Unexpected exception' });
    } });
    await app.init();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => { jest.clearAllMocks(); exceptions.length = 0; });
  afterEach(() => { expect(exceptions).toEqual([]); });

  it('clears both cookies and keeps serving HTTP after logout cleanup throws', async () => {
    auth.revokeRefreshToken.mockRejectedValue(new Error('database unavailable'));
    for (const cookie of ['refresh_token=invalid', 'access_token=expired', 'refresh_token=already-revoked']) {
      const response = await request(app.getHttpServer()).post('/auth/logout')
        .set('Origin', 'http://localhost:3000').set('Cookie', cookie).expect(201);
      expect(response.body).toEqual({ ok: true });
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toHaveLength(2);
      expect(cookies.every(value => value.includes('Expires=Thu, 01 Jan 1970') && value.includes('HttpOnly'))).toBe(true);
      await request(app.getHttpServer()).get('/auth/me').expect(200, { id: 'user-1' });
    }
  });

  it('uses configured cookie lifetimes for login and refresh', async () => {
    auth.login.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh', user: { id: 'user-1' } });
    auth.rotateRefreshToken.mockResolvedValue({ accessToken: 'next-access', refreshToken: 'next-refresh' });
    const login = await request(app.getHttpServer()).post('/auth/login')
      .set('Origin', 'http://localhost:3000').send({ email: 'guest@example.com', password: 'test-only' }).expect(201);
    expect(login.headers['set-cookie']).toEqual(expect.arrayContaining([
      expect.stringContaining('access_token=access; Max-Age=60'),
      expect.stringContaining('refresh_token=refresh; Max-Age=3600'),
    ]));
    await request(app.getHttpServer()).post('/auth/refresh').set('Origin', 'http://localhost:3000')
      .set('Cookie', 'refresh_token=refresh').expect(201);
    expect(auth.rotateRefreshToken).toHaveBeenCalledWith('refresh');
  });
});
