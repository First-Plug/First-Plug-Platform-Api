import { PartialType } from '@nestjs/mapped-types';
import { CreateOfficeDto } from './create-office.dto';
import { IsOptional, IsEmail, ValidateIf } from 'class-validator';

export class UpdateOfficeDto extends PartialType(CreateOfficeDto) {
  @IsOptional()
  @ValidateIf((o) => o.email !== '')
  @IsEmail()
  email?: string;
}
