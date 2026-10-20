export const GOOGLE_RETURN_COOKIE = 'google_oauth_return';

export function safeFrontendPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2_000 || !value.startsWith('/') ||
      value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return '/';
  try {
    const base = 'https://apartha.invalid';
    const url = new URL(value, base);
    if (url.origin !== base || /^\/(?:en\/|es\/)?(?:login|register)(?:\/|$)/.test(url.pathname)) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
