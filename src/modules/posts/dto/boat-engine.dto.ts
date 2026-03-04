import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EngineItemDto {
  @IsOptional()
  @IsString()
  engineType?: string;

  @IsOptional()
  @IsString()
  fuelType?: string;

  @IsOptional()
  @IsString()
  engineMake?: string;

  @IsOptional()
  @IsString()
  engineModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  horsePower?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  engineHours?: number;
}

export class BoatEngineDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EngineItemDto)
  engines?: EngineItemDto[];
}
