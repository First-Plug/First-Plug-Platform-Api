import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9-_]+$/, {
    message: 'tenantName solo puede contener letras, números, guiones y guiones bajos',
  })
  tenantName: string;

  @IsOptional()
  @IsString()
  image?: string;
}
