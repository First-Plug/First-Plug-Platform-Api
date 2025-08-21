import { IsString, IsOptional, MaxLength, Matches, IsNumber, IsObject } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9-_]+$/, {
    message: 'tenantName solo puede contener letras, números, guiones y guiones bajos',
  })
  tenantName?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsNumber()
  computerExpiration?: number;

  @IsOptional()
  @IsObject()
  isRecoverableConfig?: any;
}
