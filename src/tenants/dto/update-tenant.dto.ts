import { PartialType } from '@nestjs/mapped-types';
import { CreateTenantDto } from './create-tenant.dto';
import {
  IsOptional,
  IsString,
  IsNotEmpty,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateTenantDto extends PartialType(CreateTenantDto) {
  @IsOptional()
  @ValidateIf((o) => o.name !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Company name cannot be empty' })
  @MaxLength(100, { message: 'Company name cannot exceed 100 characters' })
  name?: string;

  @IsString()
  @IsOptional()
  salt?: string;
}
