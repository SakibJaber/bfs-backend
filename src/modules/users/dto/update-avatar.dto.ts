import { IsOptional, IsString, IsUrl } from 'class-validator';

/**
 * Used when the avatar URL comes back from S3 after a file upload.
 * The controller sets avatarUrl before calling the service.
 */
export class UpdateAvatarDto {
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
