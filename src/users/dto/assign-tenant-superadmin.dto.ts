import { IsString, IsOptional, IsEnum } from 'class-validator';

export class AssignTenantSuperAdminDto {
  @IsString()
  tenantId: string;

  @IsOptional()
  @IsEnum(['user', 'admin', 'superadmin'])
  role?: string = 'user';
}
