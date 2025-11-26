import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from 'src/user/dto/update-me.dto'



const toSet = (v: string | null | undefined): string | null | undefined => {
  if (v === undefined) return undefined        // no tocar
  if (v === null) return null                  // vaciar
  const t = v.trim()
  return t === '' ? null : t                   // string vacío => null
}

// Para relaciones (create/update): siempre string | null (NUNCA undefined)
const trimOrNull = (v: string | null | undefined): string | null => {
  if (v == null) return null
  const t = v.trim()
  return t === '' ? null : t
}


const userSelect = {
  id: true, email: true, name: true, avatarUrl: true, locale: true,
  phone: true, aboutMe: true,
  contactInfo: {
    select: {
      address1: true, city: true, state: true, country: true,
      zipCode: true, latitude: true, longitude: true,
    },
  },
  socialAccounts: {
    select: {
      facebook: true, twitter: true, linkedIn: true, dribbble: true,
      pinterest: true, vimeoUrl: true, youtubeUrl: true, websiteUrl: true,
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
    console.log(user);
    return user;
  }

async updateMe(userId: string, dto: UpdateMeDto) {
    return this.prisma.$transaction(async (tx) => {
        // Top-level User: usa toSet (puede devolver string | null | undefined)
        const userPatch: any = {
        name:     toSet(dto.name),
        avatarUrl:toSet(dto.avatarUrl),
        locale:   toSet(dto.locale),
        phone:    toSet(dto.phone),
        aboutMe:  toSet(dto.aboutMe),
        }

        // Relaciones 1:1 con upsert
        const relationPatch: any = {}

        // Solo si la key vino en el body (evita borrar por accidente)
        if (dto.contactInfo !== undefined) {
        if (dto.contactInfo === null) {
            // Si quisieras permitir borrar la relación: descomenta esto
            // relationPatch.contactInfo = { delete: true }
        } else {
            relationPatch.contactInfo = {
            upsert: {
                create: {
                address1:  trimOrNull(dto.contactInfo.address1),
                city:      trimOrNull(dto.contactInfo.city),
                state:     trimOrNull(dto.contactInfo.state),
                country:   trimOrNull(dto.contactInfo.country),
                zipCode:   trimOrNull(dto.contactInfo.zipCode),
                latitude:  dto.contactInfo.latitude ?? null,
                longitude: dto.contactInfo.longitude ?? null,
                },
                update: {
                address1:  trimOrNull(dto.contactInfo.address1),
                city:      trimOrNull(dto.contactInfo.city),
                state:     trimOrNull(dto.contactInfo.state),
                country:   trimOrNull(dto.contactInfo.country),
                zipCode:   trimOrNull(dto.contactInfo.zipCode),
                latitude:  dto.contactInfo.latitude ?? null,
                longitude: dto.contactInfo.longitude ?? null,
                },
            },
            }
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
                facebook:   trimOrNull(dto.socialAccounts.facebook),
                twitter:    trimOrNull(dto.socialAccounts.twitter),
                linkedIn:   trimOrNull(dto.socialAccounts.linkedIn),
                dribbble:   trimOrNull(dto.socialAccounts.dribbble),
                pinterest:  trimOrNull(dto.socialAccounts.pinterest),
                vimeoUrl:   trimOrNull(dto.socialAccounts.vimeoUrl),
                youtubeUrl: trimOrNull(dto.socialAccounts.youtubeUrl),
                websiteUrl: trimOrNull(dto.socialAccounts.websiteUrl),
                },
                update: {
                facebook:   trimOrNull(dto.socialAccounts.facebook),
                twitter:    trimOrNull(dto.socialAccounts.twitter),
                linkedIn:   trimOrNull(dto.socialAccounts.linkedIn),
                dribbble:   trimOrNull(dto.socialAccounts.dribbble),
                pinterest:  trimOrNull(dto.socialAccounts.pinterest),
                vimeoUrl:   trimOrNull(dto.socialAccounts.vimeoUrl),
                youtubeUrl: trimOrNull(dto.socialAccounts.youtubeUrl),
                websiteUrl: trimOrNull(dto.socialAccounts.websiteUrl),
                },
            },
            }
        }
        }

        await tx.user.update({
        where: { id: userId },
        data: { ...userPatch, ...relationPatch },
        })

        return tx.user.findUnique({
        where: { id: userId },
        select: userSelect, // tu select actual
        })
    })
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
        aboutMe: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        locale: true,
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
    return user;
  }
}
