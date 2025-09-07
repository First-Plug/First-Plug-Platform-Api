import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateUserSuperAdminDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsIn(['user', 'admin', 'superadmin'], {
    message: 'role must be one of: user, admin, superadmin',
  })
  role?: 'user' | 'admin' | 'superadmin';
}
