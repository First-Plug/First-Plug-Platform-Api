import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Provider } from '../schemas/tenant.schema';

export class CreateTenantByProvidersDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEmail()
  @MinLength(1)
  email: string;

  @IsString()
  @IsOptional()
  accountProvider: Provider;

  @IsString()
  @IsOptional()
  image?: string;
}
