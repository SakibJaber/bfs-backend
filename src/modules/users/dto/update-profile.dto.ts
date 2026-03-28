import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SocialLinksDto {
  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  twitter?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;

  // Set internally by controller after S3 upload — not from client body
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  // Legacy field: kept for backward-compat with existing updateProfile method
  @IsOptional()
  @IsString()
  profileImage?: string;
}
