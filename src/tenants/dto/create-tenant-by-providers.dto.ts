import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Provider } from '../schemas/tenant.schema';

export class CreateTenantByProvidersDto {
  @IsOptional()
  @IsString()
  name?: string;

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
