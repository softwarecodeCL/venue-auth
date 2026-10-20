import { validateAuthEnvironment } from './env.validation';
import { authCookieOptions, oauthStateCookieOptions } from '../auth/auth-cookies';

describe('Auth production configuration', () => {
  const input = {
    MAIL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
    PASSWORD_MAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_USER: 'test', SMTP_PASSWORD: 'test', MAIL_FROM: 'Apartha <test@example.com>',
    NODE_ENV: 'production', PORT: '3010', DATABASE_URL: 'postgresql://test:test@localhost/test',
    FRONTEND_URL: 'https://www.apartha.com', CORS_ORIGINS: 'https://www.apartha.com',
    CALLBACK_GOOGLE: 'https://auth.apartha.com/auth/google/callback',
    GOOGLE_CLIENT_ID: 'test', GOOGLE_CLIENT_SECRET: 'test',
    JWT_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40),
    COOKIE_DOMAIN: 'apartha.com', COOKIE_SAME_SITE: 'lax',
    SMS_PROVIDER: 'aws', PHONE_DEFAULT_COUNTRY: 'MX', PHONE_ALLOWED_COUNTRIES: 'MX,CL',
    PHONE_OTP_SECRET: 'c'.repeat(40), AWS_REGION: 'us-east-1',
    AWS_SMS_POOL_ID: 'pool-test', AWS_SMS_PROTECT_CONFIGURATION_ID: 'protect-test', AWS_SMS_CONFIGURATION_SET: 'test',
  };
  it('accepts AWS SMS in production and validates its argument, not global process.env', () => {
    expect(validateAuthEnvironment(input).SMS_PROVIDER).toBe('aws');
  });
  it('rejects console delivery in production', () => {
    expect(() => validateAuthEnvironment({ ...input, SMS_PROVIDER: 'console' })).toThrow();
  });
  it('rejects a cookie scoped only to Auth or missing domain', () => {
    expect(() => validateAuthEnvironment({ ...input, COOKIE_DOMAIN: 'auth.apartha.com' })).toThrow();
    expect(() => validateAuthEnvironment({ ...input, COOKIE_DOMAIN: '' })).toThrow();
  });
  it('rejects unlisted frontend and wildcard CORS', () => {
    expect(() => validateAuthEnvironment({ ...input, CORS_ORIGINS: '*' })).toThrow();
    expect(() => validateAuthEnvironment({ ...input, CORS_ORIGINS: 'https://other.apartha.com' })).toThrow();
  });
  it('retains localhost development without a cookie domain', () => {
    expect(validateAuthEnvironment({ ...input, NODE_ENV: 'development', FRONTEND_URL: 'http://localhost:3000', CORS_ORIGINS: 'http://localhost:3000', CALLBACK_GOOGLE: 'http://localhost:3010/auth/google/callback', COOKIE_DOMAIN: '', SMS_PROVIDER: 'console' }).NODE_ENV).toBe('development');
  });
  it('uses Secure + HttpOnly for sessions and host-only Lax OAuth state', () => {
    const saved = { NODE_ENV: process.env.NODE_ENV, COOKIE_DOMAIN: process.env.COOKIE_DOMAIN, COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE };
    try {
      Object.assign(process.env, { NODE_ENV: 'production', COOKIE_DOMAIN: 'apartha.com', COOKIE_SAME_SITE: 'lax' });
      expect(authCookieOptions()).toEqual({ secure: true, httpOnly: true, sameSite: 'lax', domain: 'apartha.com', path: '/' });
      expect(oauthStateCookieOptions()).toEqual({ secure: true, httpOnly: true, sameSite: 'lax', path: '/auth/google' });
    } finally {
      for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
  });
});
