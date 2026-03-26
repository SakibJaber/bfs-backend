import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateReportDto {
  @IsNotEmpty()
  @IsEnum(['pending', 'resolved', 'dismissed'])
  status: string;
}
