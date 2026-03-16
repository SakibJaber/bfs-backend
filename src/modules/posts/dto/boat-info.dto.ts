import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class BoatInfoDto {
  @IsOptional()
  @IsString()
  boatType?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  hullMaterial?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  length?: number;

  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  peopleCapacity?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
