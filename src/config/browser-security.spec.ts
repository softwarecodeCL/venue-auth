import { browserMutationGuard, parseBrowserOrigins } from './browser-security';

describe('Browser origin policy', () => {
  const frontend = 'https://www.apartha.com';
  it.each(['*', 'https://www.apartha.com/', 'https://www.apartha.com/path', 'https://user:pass@www.apartha.com', 'http://localhost:3000', 'https://localhost'])('rejects invalid production origin %s', origin => {
    expect(() => parseBrowserOrigins(origin, true)).toThrow();
  });
  it('allows exact HTTPS origins and local development', () => {
    expect(parseBrowserOrigins(frontend, true)).toEqual([frontend]);
    expect(parseBrowserOrigins('http://localhost:3000', false)).toEqual(['http://localhost:3000']);
  });
  it.each([
    ['POST', frontend, 'access_token=token', true],
    ['POST', 'https://untrusted.apartha.com', 'access_token=token', false],
    ['POST', 'null', '', false],
    ['POST', undefined, 'access_token=token', false],
    ['POST', undefined, '', true], // Stripe/server-to-server: signature checked by its handler.
    ['GET', undefined, 'access_token=token', true], // SSR read / OAuth callback.
    ['OPTIONS', frontend, '', true],
    ['POST', 'https://evil.example', '', false], // Login CSRF, even without cookies.
  ])('%s from %s with cookie=%s permitted=%s', (method, origin, cookie, permitted) => {
    const next = jest.fn();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
    browserMutationGuard([frontend])({ method, headers: { origin, cookie } } as any, res as any, next);
    expect(next).toHaveBeenCalledTimes(permitted ? 1 : 0);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    if (!permitted) expect(res.status).toHaveBeenCalledWith(403);
  });
});

