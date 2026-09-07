import type { Request, Response, NextFunction } from 'express';

export function parseBrowserOrigins(value: string, production: boolean): string[] {
  const origins = [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
  if (!origins.length) throw new Error('CORS_ORIGINS requiere al menos un origen');
  for (const origin of origins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error('CORS_ORIGINS debe contener orígenes exactos, sin rutas, credenciales ni barra final');
    }
    if (production && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
      throw new Error('CORS_ORIGINS requiere HTTPS público en producción');
    }
  }
  return origins;
}

// CORS alone does not prevent a browser from submitting a cross-origin form.
// Server-to-server calls without session cookies (e.g. Stripe) keep their own authentication.
export function browserMutationGuard(origins: string[]) {
  const allowed = new Set(origins);
  return (req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    const hasSessionCookie = /(?:^|;\s*)(?:access_token|refresh_token)=/.test(req.headers.cookie ?? '');
    if ((origin && !allowed.has(origin)) || (!origin && hasSessionCookie)) {
      return res.status(403).json({ statusCode: 403, message: 'Origen de la solicitud no permitido', error: 'Forbidden' });
    }
    return next();
  };
}

