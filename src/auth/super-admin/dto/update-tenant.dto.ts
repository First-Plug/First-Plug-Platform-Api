import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  IsNotEmpty,
  ValidateIf,
  MaxLength,
} from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @ValidateIf((o) => o.name !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Company name cannot be empty' })
  @MaxLength(20, { message: 'Company name cannot exceed 20 characters' })
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
