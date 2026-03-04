import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BoatInfoDto } from './boat-info.dto';
import { BoatEngineDto } from './boat-engine.dto';
import { BoatAdditionalDto } from './boat-additional.dto';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => BoatInfoDto)
  boat_info?: BoatInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BoatEngineDto)
  boat_engine_info?: BoatEngineDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BoatAdditionalDto)
  boat_additional_info?: BoatAdditionalDto;
}
