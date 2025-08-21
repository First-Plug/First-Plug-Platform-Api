import { IsOptional, IsString } from 'class-validator';

export class CreateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  tenantName: string;

  @IsOptional()
  @IsString()
  image?: string;
}
