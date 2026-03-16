import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class BoatAdditionalDto {
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  engineModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bridgeClearance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fuelCapacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freshWaterTank?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cruiseSpeed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  loa?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSpeed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  beam?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cabin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  draft?: number;

  @IsOptional()
  @IsString()
  mechanicalEquipment?: string;

  @IsOptional()
  @IsString()
  galleyEquipment?: string;

  @IsOptional()
  @IsString()
  deckHullEquipment?: string;

  @IsOptional()
  @IsString()
  navigationSystem?: string;

  @IsOptional()
  @IsString()
  additionalEquipment?: string;
}
