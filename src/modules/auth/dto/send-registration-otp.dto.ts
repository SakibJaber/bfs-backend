import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from 'src/common/enum/role.enum';

export class SendRegistrationOtpDto {
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;

  @IsEnum(Role)
  role: Role;
}
