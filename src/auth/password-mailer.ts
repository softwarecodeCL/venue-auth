import { Injectable, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';

@Injectable()
export class PasswordMailer {
  private readonly logger = new Logger(PasswordMailer.name);

  async send(email: string, token: string, locale: 'es' | 'en') {
    const url = new URL(locale === 'en' ? '/en/reset-password' : '/reset-password', process.env.FRONTEND_URL);
    // Fragment avoids sending the credential to HTTP access logs and referrers.
    url.hash = `token=${token}`;
    const english = locale === 'en';
    const text = english
      ? `Reset your Apartha password\n\n${url.href}\n\nThis link expires in 20 minutes and can only be used once. If you did not request it, ignore this email.`
      : `Restablece tu contraseña de Apartha\n\n${url.href}\n\nEste enlace vence en 20 minutos y solo puede utilizarse una vez. Si no lo solicitaste, ignora este correo.`;
    if ((process.env.PASSWORD_MAIL_PROVIDER || 'console') === 'console' && process.env.NODE_ENV !== 'production') {
      this.logger.debug(text);
      return;
    }
    const transport = createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === '465',
      requireTLS: process.env.SMTP_PORT !== '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM, to: email,
      subject: english ? 'Reset your Apartha password' : 'Restablece tu contraseña de Apartha',
      text,
    });
  }
}
