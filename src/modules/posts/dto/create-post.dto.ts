import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BoatInfoDto } from './boat-info.dto';
import { BoatEngineDto } from './boat-engine.dto';
import { BoatAdditionalDto } from './boat-additional.dto';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : value))
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  @IsObject()
  @ValidateNested()
  @Type(() => BoatInfoDto)
  boat_info?: BoatInfoDto;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  @IsObject()
  @ValidateNested()
  @Type(() => BoatEngineDto)
  boat_engine_info?: BoatEngineDto;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  @IsObject()
  @ValidateNested()
  @Type(() => BoatAdditionalDto)
  boat_additional_info?: BoatAdditionalDto;
}
