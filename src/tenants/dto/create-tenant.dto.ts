import {
  IsEmail,
  IsLowercase,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Provider } from '../schemas/tenant.schema';

export class CreateTenantDto {
  @IsString()
  @IsOptional()
  tenantName?: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsEmail()
  @MinLength(1)
  @IsLowercase()
  email: string;

  @IsString()
  @IsOptional()
  image?: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsString()
  @MinLength(1)
  accountProvider: Provider;
}
