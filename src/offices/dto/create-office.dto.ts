import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEmail,
  Validate,
} from 'class-validator';
import { Types } from 'mongoose';
import { CountryCodeValidator } from '../../common/validators/country-code.validator';

export class CreateOfficeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

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
  address?: string;

  @IsOptional()
  @IsString()
  apartment?: string;

  @IsString()
  tenantId: string | Types.ObjectId;
}
