import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  @MaxLength(100, { message: 'Company name cannot exceed 100 characters' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Tenant name is required' })
  tenantName: string;

  @IsOptional()
  @IsString()
  image?: string;
}
