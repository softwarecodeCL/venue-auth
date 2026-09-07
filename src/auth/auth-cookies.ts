import type { CookieOptions } from 'express';

function sameSite(): CookieOptions['sameSite'] {
  const configured = process.env.COOKIE_SAME_SITE?.toLowerCase();
  if (
    configured === 'none' ||
    configured === 'strict' ||
    configured === 'lax'
  ) {
    return configured;
  }
  return 'lax';
}

function domain() {
  const value = process.env.COOKIE_DOMAIN?.trim();
  return value || undefined;
}

export function authCookieOptions(): CookieOptions {
  const site = sameSite();
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || site === 'none',
    sameSite: site,
    path: '/',
    ...(domain() ? { domain: domain() } : {}),
  };
}

export function oauthStateCookieOptions(): CookieOptions {
  const { domain: _domain, ...options } = authCookieOptions();
  return {
    ...options,
    sameSite: 'lax',
    path: '/auth/google',
  };
}
