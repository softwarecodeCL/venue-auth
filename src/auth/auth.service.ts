// src/auth/auth.service.ts (añade/ajusta)
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMeDto } from 'src/user/dto/update-me.dto';
import type { Prisma } from '@prisma/client'


type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  locale: string | null;
  phone: string | null;
};

@Injectable()
export class AuthService {
  
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

   async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('El email ya está registrado');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name ?? null,
        passwordHash,
        authProviders: {
          create: { provider: 'local', providerUserId: dto.email },
        },
      },
      select: { id: true, email: true, name: true },
    });

    return user; // o { user } si prefieres
  }
  // login local
async login(dto: LoginDto) {
  const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
  if (!user || !user.passwordHash) throw new UnauthorizedException('Credenciales inválidas');
  const ok = await bcrypt.compare(dto.password, user.passwordHash);
  if (!ok) throw new UnauthorizedException('Credenciales inválidas');

  await this.prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const accessToken = this.signAccess({ sub: user.id, email: user.email });
  const refreshToken = await this.issueRefresh(user.id);
  return { accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email } };
}


  async rotateRefreshToken(rt: string | undefined) {
    if (!rt) throw new UnauthorizedException('No refresh token');

    const payload = this.verifyRefresh(rt); // { sub: string, type?: string }

    // 1) Traer el usuario para obtener email (y validar que exista)
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    // 2) Firmar un nuevo access con email seguro desde DB
    const accessToken = this.signAccess({ sub: user.id, email: user.email });

    // 3) Rotar refresh
    const refreshToken = await this.issueRefresh(user.id);

    return { accessToken, refreshToken };
  }

  // revocación de refresh
  async revokeRefreshToken(rt: string | undefined) {
    if (!rt) return;
    // opcional: marca como revocado en DB si lo persistes
    return;
  }

  // helpers
  private signAccess(payload: { sub: string; email: string }) {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET!,
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    });
  }

  private verifyRefresh(token: string) {
    return this.jwtService.verify(token, {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
    }) as { sub: string; type?: string }; // <- sin email aquí
  }

  private async issueRefresh(userId: string) {
    // si quieres máxima seguridad: genera aleatorio y guarda hash en DB; aquí simple con JWT:
    return this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      },
    );
  }

async loginWithOAuth(profile: {
  email: string | null; name: string | null; avatarUrl?: string | null;
  locale?: string | null; emailVerified?: boolean;
  provider: 'google'; providerUserId?: string | null;
  phone?: string | null;
}) {
  if (!profile?.email) throw new UnauthorizedException('Perfil sin email');

  // un select único para mantener el mismo shape SIEMPRE
  const select = {
    id: true,
    email: true,
    name: true,
    avatarUrl: true,
    locale: true,
    phone: true,
  } as const;

  const found = await this.prisma.user.findUnique({
    where: { email: profile.email },
    select,
  });

  let user: PublicUser;

  if (!found) {
    user = await this.prisma.user.create({
      data: {
        email: profile.email!,
        name: profile.name,
        avatarUrl: profile.avatarUrl ?? null,
        emailVerified: profile.emailVerified ?? false,
        locale: profile.locale ?? null,
        lastLogin: new Date(),
        authProviders: {
          create: {
            provider: 'google',
            providerUserId: profile.providerUserId ?? profile.email!,
          },
        },
      },
      select,
    });
  } else {
    user = await this.prisma.user.update({
      where: { id: found.id },
      data: {
        name: found.name ?? profile.name,
        avatarUrl: profile.avatarUrl ?? found.avatarUrl,
        emailVerified: profile.emailVerified ?? true, // o lo que prefieras
        locale: profile.locale ?? found.locale,
        lastLogin: new Date(),
      },
      select,
    });
  }

  const accessToken = this.signAccess({ sub: user.id, email: user.email });
  const refreshToken = await this.issueRefresh(user.id);

  return { accessToken, refreshToken, user };
}

  async updateProfile(userId: string, dto: UpdateMeDto) {
    const data: Prisma.UserUpdateInput = {
      name:      dto.name      ?? undefined,
      avatarUrl: dto.avatarUrl ?? undefined,
      locale:    dto.locale    ?? undefined,
      phone:     dto.phone     ?? undefined,
      aboutMe:   dto.aboutMe   ?? undefined,

      contactInfo: dto.contactInfo
        ? {
            upsert: {
              create: {
                address1:  dto.contactInfo.address1  ?? null,
                city:      dto.contactInfo.city      ?? null,
                state:     dto.contactInfo.state     ?? null,
                country:   dto.contactInfo.country   ?? null,
                zipCode:   dto.contactInfo.zipCode   ?? null,
                latitude:  dto.contactInfo.latitude  ?? null,
                longitude: dto.contactInfo.longitude ?? null,
              },
              update: {
                address1:  dto.contactInfo.address1  ?? null,
                city:      dto.contactInfo.city      ?? null,
                state:     dto.contactInfo.state     ?? null,
                country:   dto.contactInfo.country   ?? null,
                zipCode:   dto.contactInfo.zipCode   ?? null,
                latitude:  dto.contactInfo.latitude  ?? null,
                longitude: dto.contactInfo.longitude ?? null,
              },
            },
          }
        : undefined,

      socialAccounts: dto.socialAccounts
        ? {
            upsert: {
              create: {
                facebook:   dto.socialAccounts.facebook   ?? null,
                twitter:    dto.socialAccounts.twitter    ?? null,
                linkedIn:   dto.socialAccounts.linkedIn   ?? null,
                dribbble:   dto.socialAccounts.dribbble   ?? null,
                pinterest:  dto.socialAccounts.pinterest  ?? null,
                vimeoUrl:   dto.socialAccounts.vimeoUrl   ?? null,
                youtubeUrl: dto.socialAccounts.youtubeUrl ?? null,
                websiteUrl: dto.socialAccounts.websiteUrl ?? null,
              },
              update: {
                facebook:   dto.socialAccounts.facebook   ?? null,
                twitter:    dto.socialAccounts.twitter    ?? null,
                linkedIn:   dto.socialAccounts.linkedIn   ?? null,
                dribbble:   dto.socialAccounts.dribbble   ?? null,
                pinterest:  dto.socialAccounts.pinterest  ?? null,
                vimeoUrl:   dto.socialAccounts.vimeoUrl   ?? null,
                youtubeUrl: dto.socialAccounts.youtubeUrl ?? null,
                websiteUrl: dto.socialAccounts.websiteUrl ?? null,
              },
            },
          }
        : undefined,
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true, email: true, name: true, avatarUrl: true, emailVerified: true,
        phone: true, aboutMe: true, locale: true, createdAt: true, updatedAt: true,
        contactInfo: true, socialAccounts: true,
      },
    })
  }
}
