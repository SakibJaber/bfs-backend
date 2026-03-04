import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadMediaDto {
  @IsOptional()
  @IsEnum(['image', 'video'])
  type?: 'image' | 'video';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  order?: number;
}
