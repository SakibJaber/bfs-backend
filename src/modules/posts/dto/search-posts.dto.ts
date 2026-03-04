import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchPostsDto {
  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @IsOptional()
  @IsString()
  boatType?: string;

  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(2100)
  @Type(() => Number)
  minYear?: number;

  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(2100)
  @Type(() => Number)
  maxYear?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minLength?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxLength?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 15;
}
