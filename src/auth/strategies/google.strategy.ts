import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';


function deriveLanguage(locale?: string | null): string | null {
  if (!locale) return null;
  return String(locale).split(/[-_]/)[0];
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.CALLBACK_GOOGLE as string,
      scope: ['openid','email', 'profile'],
      passReqToCallback: true,
     // state: true,
    });
  }

  
async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const email = profile?.emails?.[0]?.value ?? null;
    const picture = profile?.photos?.[0]?.value ?? null;

    const displayName: string | null =
      profile?.displayName
      ?? [profile?.name?.givenName, profile?.name?.familyName].filter(Boolean).join(' ')
      ?? null;

    const raw = profile?._json ?? {};
    const locale: string | null = raw?.locale ?? null;
    const language: string | null = deriveLanguage(locale);
    const emailVerified: boolean =
      raw?.email_verified ?? raw?.verified_email ?? false;

    const userPayload = {
      email,
      name: displayName,
      avatarUrl: picture,
      locale,
      language,
      provider: 'google',
      providerUserId: profile?.id ?? email ?? undefined,
      emailVerified,
    };

    return done(null, userPayload);
  }
}