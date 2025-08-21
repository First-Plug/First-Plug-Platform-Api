import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  tenantName?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsNumber()
  computerExpiration?: number;

  @IsOptional()
  @IsObject()
  isRecoverableConfig?: Map<string, boolean>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
