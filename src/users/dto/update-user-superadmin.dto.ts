import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateUserSuperAdminDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEnum(['user', 'admin', 'superadmin'], {
    message: 'role must be one of: user, admin, superadmin'
  })
  role?: string;
}
