import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @IsNotEmpty()
  @IsString()
  targetId: string;

  @IsNotEmpty()
  @IsEnum(['user', 'post'])
  targetType: string;

  @IsNotEmpty()
  @IsString()
  note: string;

  @IsOptional()
  @IsString()
  image?: string;
}
