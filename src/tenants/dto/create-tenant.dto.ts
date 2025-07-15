import { IsOptional, IsString } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  name: string;

  @IsString()
  tenantName: string;

  @IsOptional()
  @IsString()
  image?: string;
}
