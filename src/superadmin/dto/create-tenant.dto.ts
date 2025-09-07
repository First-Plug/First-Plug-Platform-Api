import {
  IsString,
  IsOptional,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  @MaxLength(100, { message: 'Company name cannot exceed 100 characters' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Tenant name is required' })
  @MaxLength(50, { message: 'Tenant name cannot exceed 50 characters' })
  @Matches(/^[a-zA-Z0-9-_]+$/, {
    message:
      'tenantName solo puede contener letras, números, guiones y guiones bajos',
  })
  tenantName: string;

  @IsOptional()
  @IsString()
  image?: string;
}
