import {
  IsOptional,
  IsString,
  IsEmail,
  ValidateIf,
  Validate,
} from 'class-validator';
import { CountryCodeValidator } from '../../common/validators/country-code.validator';

/**
 * DTO para actualizar la configuración/perfil del usuario
 * Incluye datos personales del usuario
 */
export class UpdateUserConfigDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @ValidateIf((o) => o.personalEmail !== '')
  @IsEmail()
  personalEmail?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  apartment?: string;

  @IsOptional()
  @IsString()
  @Validate(CountryCodeValidator)
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsString()
  image?: string;
}
