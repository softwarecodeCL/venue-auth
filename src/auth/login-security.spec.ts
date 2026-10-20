import { hash } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { HttpException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { assertNewPassword } from './password-policy';
import { readGoogleLink, signGoogleLink } from './google-link';
import { GoogleOAuthStartGuard, GoogleOAuthCallbackGuard } from './guards/google-oauth.guard';

describe('Login identity security', () => {
  let db: any, service: AuthService, user: any;
  const google = { provider: 'google' as const, providerUserId: 'google-owner', email: 'owner@example.com', emailVerified: true, name: 'Owner' };
  beforeEach(async () => {
    process.env.JWT_SECRET = 'isolated-login-test-secret';
    user = { id: 'owner', email: google.email, emailVerified: true, status: 'ACTIVE', deletedAt: null,
      passwordHash: await hash('owner passphrase', 4), passwordVerifiedAt: new Date(), sessionVersion: 2,
      roles: [{ role: 'GUEST' }], authProviders: [], phoneVerified: true, profileCompletedAt: new Date() };
    db = { $executeRaw: jest.fn(), user: { findUnique: jest.fn(async () => user),
      update: jest.fn(async ({ data }) => { const { roles, ...fields } = data; Object.assign(user, fields, data.sessionVersion ? { sessionVersion: user.sessionVersion + 1 } : {}); return { ...user }; }), create: jest.fn() },
      authProvider: { findUnique: jest.fn(async () => null), create: jest.fn() },
      refreshSession: { updateMany: jest.fn() }, passwordResetToken: { updateMany: jest.fn() } };
    db.$transaction = jest.fn((fn: any) => fn(db));
    service = new AuthService(db, new JwtService());
    jest.spyOn(service as any, 'createSessionTokens').mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
  });

  it('blocks pre-registration takeover: a Google match never activates the existing password', async () => {
    user.emailVerified = false; user.passwordVerifiedAt = null;
    await expect(service.loginWithOAuth(google)).rejects.toMatchObject({ response: { code: 'GOOGLE_LINK_REQUIRED' } });
    expect(db.authProvider.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    await expect(service.login({ email: google.email, password: 'owner passphrase' }))
      .rejects.toMatchObject({ response: { code: 'EMAIL_VERIFICATION_REQUIRED' } });
    expect(service['createSessionTokens']).not.toHaveBeenCalled();
  });
  it('blocks legacy passwords even if Google previously marked the email verified', async () => {
    user.passwordVerifiedAt = null;
    await expect(service.getAuthenticatedUser('owner', 2)).rejects.toMatchObject({ response: { code: 'EMAIL_VERIFICATION_REQUIRED' } });
    await expect(service.login({ email: google.email, password: 'owner passphrase' })).rejects.toThrow();
  });
  it('lets a proven password use the same account without disclosing credentials', async () => {
    const result = await service.login({ email: google.email.toUpperCase(), password: 'owner passphrase' });
    expect(result.user.id).toBe('owner');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('passwordVerifiedAt');
  });
  it('rejects bad passwords and unknown accounts with the same public error', async () => {
    await expect(service.login({ email: google.email, password: 'wrong' })).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
    db.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: google.email, password: 'wrong' })).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
  });
  it.each(['different-email', 'changed-session', 'unproven-password', 'other-owner'])('refuses explicit linking for %s', async scenario => {
    if (scenario === 'different-email') user.email = 'different@example.com';
    if (scenario === 'changed-session') user.sessionVersion = 3;
    if (scenario === 'unproven-password') user.passwordVerifiedAt = null;
    if (scenario === 'other-owner') db.authProvider.findUnique.mockResolvedValue({ userId: 'other' });
    await expect(service.loginWithOAuth(google, { sub: 'owner', version: 2 })).rejects.toThrow();
    expect(db.authProvider.create).not.toHaveBeenCalled();
    expect(service['createSessionTokens']).not.toHaveBeenCalled();
  });
  it('recovers legacy linked Google access, removing only unproven credentials and sessions', async () => {
    user.passwordVerifiedAt = null;
    db.authProvider.findUnique.mockResolvedValue({ userId: user.id });
    await service.loginWithOAuth(google);
    expect(user.passwordHash).toBeNull();
    expect(user.sessionVersion).toBe(3);
    expect(user.phoneVerified).toBe(true);
    expect(db.refreshSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner', revokedAt: null } }));
    expect(db.passwordResetToken.updateMany).toHaveBeenCalled();
    expect(db.authProvider.create).not.toHaveBeenCalled();
  });
  it('preserves a proven password during normal Google sign-in', async () => {
    db.authProvider.findUnique.mockResolvedValue({ userId: user.id });
    const previous = user.passwordHash;
    await service.loginWithOAuth(google);
    expect(user.passwordHash).toBe(previous);
    expect(db.refreshSession.updateMany).not.toHaveBeenCalled();
  });
  it('issues a short linking intent only after checking the current proven password', async () => {
    await expect(service.googleLinkIntent('owner', 'wrong')).rejects.toMatchObject({ status: 400, response: { code: 'PASSWORD_CURRENT_INVALID' } });
    const token = await service.googleLinkIntent('owner', 'owner passphrase');
    expect(readGoogleLink(new JwtService(), token)).toMatchObject({ sub: 'owner', version: 2 });
    const payload: any = new JwtService().decode(token);
    expect(payload.exp - payload.iat).toBe(300);
    const access = new JwtService().sign({ sub: 'owner', type: 'access', version: 2 }, { secret: process.env.JWT_SECRET });
    expect(() => readGoogleLink(new JwtService(), access)).toThrow();
  });
  it('validates new password length in UTF-8 bytes, retaining spaces', () => {
    expect(() => assertNewPassword('short')).toThrow();
    expect(() => assertNewPassword('\u{1f30d}'.repeat(19))).toThrow();
    expect(() => assertNewPassword(' a long pass phrase ')).not.toThrow();
    expect(() => assertNewPassword('a'.repeat(72))).not.toThrow();
    expect(() => assertNewPassword('a'.repeat(73))).toThrow();
  });
});

describe('Login boundary and OAuth browser binding', () => {
  it('checks shared IP, pair and account quotas before comparing any password', async () => {
    const login = jest.fn(); const limit = jest.fn().mockResolvedValue(undefined);
    const controller = new AuthController({ login } as any, {} as any, { limit } as any);
    const res = { setHeader: jest.fn() } as any;
    limit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new HttpException({ code: 'ACCOUNT_RATE_LIMIT', retryAfterSeconds: 42 }, 429));
    await expect(controller.login({ email: 'Owner@Example.com', password: 'password' }, res,
      { ip: '192.0.2.1', headers: { 'x-forwarded-for': 'spoofed' } } as any)).rejects.toMatchObject({ status: 429 });
    expect(limit.mock.calls).toEqual([['login-ip:192.0.2.1', 30, 900], ['login-pair:192.0.2.1:owner@example.com', 5, 60]]);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '42');
    expect(login).not.toHaveBeenCalled();
  });
  const context = (req: any, res: any) => ({ switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) }) as any;
  it('binds the explicit linking cookie to the browser account and new random OAuth state', () => {
    const jwt = new JwtService(); process.env.JWT_SECRET = 'oauth-binding-test';
    const cookies = { google_link_intent: signGoogleLink(jwt, { sub: 'owner', version: 1 }),
      access_token: jwt.sign({ sub: 'owner', version: 1, type: 'access' }, { secret: process.env.JWT_SECRET, expiresIn: 300 }) };
    const req = { query: { link: '1', returnTo: '/dashboard-my-profile' }, cookies };
    const res = { cookie: jest.fn(), clearCookie: jest.fn() };
    const result = new GoogleOAuthStartGuard().getAuthenticateOptions(context(req, res));
    const signed = res.cookie.mock.calls.find(call => call[0] === 'google_link_intent')[1];
    expect(readGoogleLink(jwt, signed).state).toBe(result.state);
    cookies.access_token = jwt.sign({ sub: 'other', version: 1, type: 'access' }, { secret: process.env.JWT_SECRET });
    expect(() => new GoogleOAuthStartGuard().getAuthenticateOptions(context(req, res))).toThrow();
  });
  it('rejects callback state mismatches and absent state before contacting Google', () => {
    for (const cookies of [{}, { google_oauth_state: 'different' }]) {
      expect(() => new GoogleOAuthCallbackGuard().canActivate(context({ cookies, query: { state: 'received' } }, { clearCookie: jest.fn() }))).toThrow();
    }
  });
});
