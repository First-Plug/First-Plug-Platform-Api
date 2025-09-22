import {
  IsString,
  IsOptional,
  IsEmail,
  ValidateIf,
  IsNotEmpty,
  Validate,
} from 'class-validator';
import { CountryCodeValidator } from '../../common/validators/country-code.validator';

export class UpdateTenantOfficeDto {
  @IsOptional()
  @ValidateIf((o) => o.name !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Office name cannot be empty' })
  name?: string;

  @IsOptional()
  @ValidateIf((o) => o.email !== '' && o.email !== undefined)
  @IsEmail()
  email?: string;

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
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  @Validate(CountryCodeValidator)
  country?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  // 🔧 Campos a borrar (setear como string vacío)
  @IsOptional()
  @IsString({ each: true })
  fieldsToEmpty?: string[];
}
