import {
  IsOptional,
  IsEnum,
  ValidateIf,
  IsMongoId,
  IsString,
} from 'class-validator';

export enum UserRoleDto {
  user = 'user',
  admin = 'admin',
  superadmin = 'superadmin',
}

export class AssignTenantSuperAdminDto {
  @IsOptional()
  @IsEnum(UserRoleDto)
  role?: UserRoleDto = UserRoleDto.user;

  @ValidateIf((o) => (o.role ?? UserRoleDto.user) !== UserRoleDto.superadmin)
  @IsMongoId()
  tenantId?: string;

  @ValidateIf((o) => (o.role ?? UserRoleDto.user) !== UserRoleDto.superadmin)
  @IsOptional()
  @IsString()
  tenantName?: string;
}
