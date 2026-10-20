import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { queueAccountEmail } from '../auth/account-email';
import { withVerifiedPhone } from './verified-phone';

const toSet = (v: string | null | undefined): string | null | undefined => {
  if (v === undefined) return undefined; // no tocar
  if (v === null) return null; // vaciar
  const t = v.trim();
  return t === '' ? null : t; // string vacío => null
};

// Para relaciones (create/update): siempre string | null (NUNCA undefined)
const trimOrNull = (v: string | null | undefined): string | null => {
  if (v == null) return null;
  const t = v.trim();
  return t === '' ? null : t;
};

const userSelect = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  locale: true,
  phone: true,
  phoneVerified: true,
  PhoneIdentity: { select: { phoneE164: true } },
  aboutMe: true,
  profileCompletedAt: true,
  roles: { select: { role: true } },
  contactInfo: {
    select: {
      address1: true,
      city: true,
      state: true,
      country: true,
      zipCode: true,
      latitude: true,
      longitude: true,
    },
  },
  socialAccounts: {
    select: {
      facebook: true,
      twitter: true,
      linkedIn: true,
      dribbble: true,
      pinterest: true,
      vimeoUrl: true,
      youtubeUrl: true,
      websiteUrl: true,
    },
  },
} as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return withVerifiedPhone(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    if (dto.name !== undefined && (typeof dto.name !== 'string' || dto.name.trim().length < 2)) {
      throw new BadRequestException('El nombre debe tener al menos dos caracteres');
    }
    return this.prisma.$transaction(async (tx) => {
      // Top-level User: usa toSet (puede devolver string | null | undefined)
      const userPatch: Prisma.UserUpdateInput = {
        name: toSet(dto.name),
        avatarUrl: toSet(dto.avatarUrl),
        locale: toSet(dto.locale),
        aboutMe: toSet(dto.aboutMe),
      };

      // Relaciones 1:1 con upsert
      const relationPatch: Prisma.UserUpdateInput = {};

      // Solo si la key vino en el body (evita borrar por accidente)
      if (dto.contactInfo !== undefined) {
        if (dto.contactInfo === null) {
          // Si quisieras permitir borrar la relación: descomenta esto
          // relationPatch.contactInfo = { delete: true }
        } else {
          relationPatch.contactInfo = {
            upsert: {
              create: {
                address1: trimOrNull(dto.contactInfo.address1),
                city: trimOrNull(dto.contactInfo.city),
                state: trimOrNull(dto.contactInfo.state),
                country: trimOrNull(dto.contactInfo.country),
                zipCode: trimOrNull(dto.contactInfo.zipCode),
                latitude: dto.contactInfo.latitude ?? null,
                longitude: dto.contactInfo.longitude ?? null,
              },
              update: {
                address1: toSet(dto.contactInfo.address1),
                city: toSet(dto.contactInfo.city),
                state: toSet(dto.contactInfo.state),
                country: toSet(dto.contactInfo.country),
                zipCode: toSet(dto.contactInfo.zipCode),
                latitude: dto.contactInfo.latitude,
                longitude: dto.contactInfo.longitude,
              },
            },
          };
        }
      }

      if (dto.socialAccounts !== undefined) {
        if (dto.socialAccounts === null) {
          // Si quisieras permitir borrar la relación: descomenta esto
          // relationPatch.socialAccounts = { delete: true }
        } else {
          relationPatch.socialAccounts = {
            upsert: {
              create: {
                facebook: trimOrNull(dto.socialAccounts.facebook),
                twitter: trimOrNull(dto.socialAccounts.twitter),
                linkedIn: trimOrNull(dto.socialAccounts.linkedIn),
                dribbble: trimOrNull(dto.socialAccounts.dribbble),
                pinterest: trimOrNull(dto.socialAccounts.pinterest),
                vimeoUrl: trimOrNull(dto.socialAccounts.vimeoUrl),
                youtubeUrl: trimOrNull(dto.socialAccounts.youtubeUrl),
                websiteUrl: trimOrNull(dto.socialAccounts.websiteUrl),
              },
              update: {
                facebook: toSet(dto.socialAccounts.facebook),
                twitter: toSet(dto.socialAccounts.twitter),
                linkedIn: toSet(dto.socialAccounts.linkedIn),
                dribbble: toSet(dto.socialAccounts.dribbble),
                pinterest: toSet(dto.socialAccounts.pinterest),
                vimeoUrl: toSet(dto.socialAccounts.vimeoUrl),
                youtubeUrl: toSet(dto.socialAccounts.youtubeUrl),
                websiteUrl: toSet(dto.socialAccounts.websiteUrl),
              },
            },
          };
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: { ...userPatch, ...relationPatch },
      });

      const updated = await tx.user.findUnique({
        where: { id: userId },
        select: userSelect, // tu select actual
      });
      return updated ? withVerifiedPhone(updated) : null;
    });
  }

  async completeProfile(userId: string, dto: CompleteProfileDto) {
    const name = dto.name.trim();
    if (name.length < 2 || name.length > 80) {
      throw new BadRequestException('El nombre debe tener entre 2 y 80 caracteres');
    }
    if (dto.mode === Role.HOST && dto.hostDeclarationAccepted !== true) {
      throw new BadRequestException({ code: 'HOST_DECLARATION_REQUIRED' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          name,
          profileCompletedAt: new Date(),
        },
      });

      await tx.userRole.upsert({
        where: { userId_role: { userId, role: Role.GUEST } },
        create: { userId, role: Role.GUEST },
        update: {},
      });

      if (dto.mode === Role.HOST) {
        // Operational declaration, not identity or ownership verification.
        // Preserve the first acceptance of this version on repeated requests.
        await tx.$executeRaw`
          INSERT INTO "public"."HostDeclaration" ("userId", "version")
          VALUES (${userId}, ${'2026-10-17'})
          ON CONFLICT ("userId") DO NOTHING
        `;
        await tx.userRole.upsert({
          where: { userId_role: { userId, role: Role.HOST } },
          create: { userId, role: Role.HOST },
          update: {},
        });

        await tx.providerProfile.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });
        await queueAccountEmail(tx, userId, 'HOST_CREATED', `host-created:${userId}`);
      }
    });

    return this.getMe(userId);
  }

  async getEditableProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        // Campos del usuario (excluye passwordHash)
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        emailVerified: true,
        phone: true,
        phoneVerified: true,
        PhoneIdentity: { select: { phoneE164: true } },
        aboutMe: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        locale: true,
        profileCompletedAt: true,
        roles: { select: { role: true } },
        // Relaciones
        contactInfo: {
          select: {
            address1: true,
            city: true,
            state: true,
            country: true,
            zipCode: true,
            latitude: true,
            longitude: true,
          },
        },
        socialAccounts: {
          select: {
            facebook: true,
            twitter: true,
            linkedIn: true,
            dribbble: true,
            pinterest: true,
            vimeoUrl: true,
            youtubeUrl: true,
            websiteUrl: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    return withVerifiedPhone(user);
  }
}
