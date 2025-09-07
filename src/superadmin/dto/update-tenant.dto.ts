import {
  IsString,
  IsOptional,
  MaxLength,
  Matches,
  IsNumber,
  IsObject,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @ValidateIf((o) => o.name !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Company name cannot be empty' })
  @MaxLength(100, { message: 'Company name cannot exceed 100 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9-_]+$/, {
    message:
      'tenantName solo puede contener letras, números, guiones y guiones bajos',
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
