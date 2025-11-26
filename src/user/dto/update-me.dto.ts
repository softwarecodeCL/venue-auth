import {
  IsOptional, IsString, IsUrl, MaxLength, Matches, ValidateNested,
  IsLatitude, IsLongitude, ValidateIf
} from 'class-validator';
import { Type } from 'class-transformer';

export class ContactInfoDto {
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString() @MaxLength(200)
  address1?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString() @MaxLength(80)
  city?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString() @MaxLength(80)
  state?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString() @MaxLength(80)
  country?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString() @MaxLength(20)
  zipCode?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsLatitude()
  latitude?: number | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsLongitude()
  longitude?: number | null;
}

export class SocialAccountsDto {
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_protocol: true })
  facebook?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_protocol: true })
  twitter?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_protocol: true })
  linkedIn?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_protocol: true })
  dribbble?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_protocol: true })
  pinterest?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_protocol: true })
  vimeoUrl?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_protocol: true })
  youtubeUrl?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_protocol: true })
  websiteUrl?: string | null;
}

export class UpdateMeDto {
  // Campos User
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString() @MaxLength(80)
  name?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_protocol: true })
  avatarUrl?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString() @MaxLength(10)
  locale?: string | null;

  // +56 9 1234 5678 (flexible; ajusta a tu realidad)
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(/^[0-9+\-() ]{6,20}$/)
  phone?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString() @MaxLength(1000)
  aboutMe?: string | null;

  // Relaciones 1:1
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @ValidateNested()
  @Type(() => ContactInfoDto)
  contactInfo?: ContactInfoDto | null;

  @IsOptional() @ValidateIf((_, v) => v !== null && v !== undefined)
  @ValidateNested()
  @Type(() => SocialAccountsDto)
  socialAccounts?: SocialAccountsDto | null;
}
