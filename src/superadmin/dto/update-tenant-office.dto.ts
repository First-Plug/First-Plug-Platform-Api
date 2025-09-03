import { IsString, IsOptional, IsEmail, ValidateIf } from 'class-validator';

export class UpdateTenantOfficeDto {
  @IsOptional()
  @IsString()
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
  country?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  // 🔧 Campos a borrar (setear como string vacío)
  @IsOptional()
  @IsString({ each: true })
  fieldsToEmpty?: string[];
}
