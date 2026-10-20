import { z } from 'zod';
import { parseBrowserOrigins } from './browser-security';

const optionalText = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === ''
      ? undefined
      : value,
  z.string().min(1).optional(),
);
const authEnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3010),
    DATABASE_URL: z
      .string()
      .min(1)
      .refine(
        (value) =>
          value.startsWith('postgresql://') ||
          value.startsWith('postgres://'),
        'Debe ser una URL PostgreSQL',
      ),

    FRONTEND_URL: z.string().url(),
    CORS_ORIGINS: z.string().min(1),

    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().min(2).default('50m'),
    JWT_REFRESH_EXPIRES_IN: z.string().min(2).default('30d'),

    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    CALLBACK_GOOGLE: z.string().url(),

    COOKIE_DOMAIN: optionalText,
    COOKIE_SAME_SITE: z
      .enum(['lax', 'strict', 'none'])
      .default('lax'),

    PASSWORD_MAIL_PROVIDER: z.enum(['console', 'smtp', 'outbox']).default('console'),
    AUTH_TRUST_PROXY: optionalText,
    SMTP_HOST: optionalText,
    SMTP_PORT: z.coerce.number().int().refine(v => v === 465 || v === 587).default(587),
    SMTP_USER: optionalText,
    SMTP_PASSWORD: optionalText,
    MAIL_FROM: optionalText,
    MAIL_TOKEN_ENCRYPTION_KEY: optionalText,
    SMS_PROVIDER: z.enum(['console', 'aws']),
    PHONE_DEFAULT_COUNTRY: z.string().regex(/^[A-Z]{2}$/),
    PHONE_ALLOWED_COUNTRIES: z.string().min(2),
    PHONE_OTP_SECRET: z.string().min(32),
    AWS_SMS_CONFIGURATION_SET: z.string().trim().min(1).optional(),
    PHONE_OTP_EXPIRES_MINUTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(30)
      .default(10),
    PHONE_OTP_RESEND_SECONDS: z.coerce
      .number()
      .int()
      .min(15)
      .max(600)
      .default(60),
    PHONE_OTP_MAX_ATTEMPTS: z.coerce
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5),
    PHONE_OTP_SENDS_PER_HOUR: z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5),

    AWS_REGION: optionalText,
    AWS_SNS_SENDER_ID: optionalText,
  })
  .passthrough();


  function validateSmsRuntimeEnvironment(input: Record<string, unknown>): void {
    const production = input.NODE_ENV === 'production';

    const provider =
      String(input.SMS_PROVIDER ?? '').trim().toLowerCase() ||
      (production ? 'aws' : 'console');

    if (production && provider !== 'aws') {
      throw new Error(
        'SMS_PROVIDER debe ser aws en producción',
      );
    }

    if (provider !== 'aws') {
      return;
    }

    const requiredVariables = [
      'AWS_REGION',
      'AWS_SMS_POOL_ID',
      'AWS_SMS_PROTECT_CONFIGURATION_ID',
      'AWS_SMS_CONFIGURATION_SET',
    ] as const;

    const missingVariables = requiredVariables.filter(
      (name) => !String(input[name] ?? '').trim(),
    );

    if (missingVariables.length > 0) {
      throw new Error(
        `Faltan variables para AWS SMS: ${missingVariables.join(', ')}`,
      );
    }
  }

export function validateAuthEnvironment(
  input: Record<string, unknown>,
) {
  validateSmsRuntimeEnvironment(input);
  const parsed = authEnvironmentSchema.safeParse(input);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map(
        (issue) =>
          `${issue.path.join('.') || 'ENV'}: ${issue.message}`,
      )
      .join('\n');

    throw new Error(`Variables de Auth inválidas:\n${details}`);
  }

  const env = parsed.data;
  const errors: string[] = [];
  if (env.NODE_ENV === 'production' && env.PASSWORD_MAIL_PROVIDER === 'console') errors.push('Producción requiere PASSWORD_MAIL_PROVIDER=outbox (smtp es un alias compatible)');
  if (env.PASSWORD_MAIL_PROVIDER !== 'console' && Buffer.from(env.MAIL_TOKEN_ENCRYPTION_KEY || '', 'base64').length !== 32) errors.push('MAIL_TOKEN_ENCRYPTION_KEY debe ser una clave de 32 bytes en base64 compartida con Web API');

  const origins = parseBrowserOrigins(env.CORS_ORIGINS, env.NODE_ENV === 'production');
  if (!origins.includes(new URL(env.FRONTEND_URL).origin)) errors.push('CORS_ORIGINS debe incluir FRONTEND_URL');
  if (env.NODE_ENV === 'production') {
    const domain = env.COOKIE_DOMAIN?.replace(/^\./, '');
    const hosts = [new URL(env.FRONTEND_URL).hostname, new URL(env.CALLBACK_GOOGLE).hostname];
    if (!domain || domain.split('.').length < 2 || hosts.some(host => host !== domain && !host.endsWith(`.${domain}`))) {
      errors.push('COOKIE_DOMAIN debe ser el dominio compartido de frontend y Auth, sin protocolo (apartha.com)');
    }
    if (env.COOKIE_SAME_SITE !== 'lax') errors.push('Usa COOKIE_SAME_SITE=lax para esta instalación entre subdominios');
  }

  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push('JWT_SECRET y JWT_REFRESH_SECRET deben ser diferentes');
  }

  const allowedCountries = env.PHONE_ALLOWED_COUNTRIES.split(',')
    .map((country) => country.trim().toUpperCase())
    .filter(Boolean);

  if (
    allowedCountries.length === 0 ||
    allowedCountries.some((country) => !/^[A-Z]{2}$/.test(country))
  ) {
    errors.push(
      'PHONE_ALLOWED_COUNTRIES debe contener códigos ISO de dos letras',
    );
  }

  const corsOrigins = env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of corsOrigins) {
    try {
      new URL(origin);
    } catch {
      errors.push(`Origen CORS inválido: ${origin}`);
    }
  }

  if (env.SMS_PROVIDER === 'aws' && !env.AWS_REGION) {
    errors.push('AWS_REGION es obligatorio con SMS_PROVIDER=aws');
  }

  if (env.NODE_ENV === 'production') {
    if (env.SMS_PROVIDER !== 'aws') {
      errors.push('Producción requiere SMS_PROVIDER=aws');
    }

    const secureUrls: Array<[string, string]> = [
      ['FRONTEND_URL', env.FRONTEND_URL],
      ['CALLBACK_GOOGLE', env.CALLBACK_GOOGLE],
      ...corsOrigins.map(
        (origin) => ['CORS_ORIGINS', origin] as [string, string],
      ),
    ];

    for (const [name, value] of secureUrls) {
      const url = new URL(value);

      if (url.protocol !== 'https:') {
        errors.push(`${name} debe utilizar HTTPS en producción`);
      }

      if (['localhost', '127.0.0.1'].includes(url.hostname)) {
        errors.push(`${name} no puede apuntar a localhost en producción`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Variables de Auth incompatibles:\n${errors.join('\n')}`,
    );
  }

  return env;
}
