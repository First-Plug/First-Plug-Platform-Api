import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import {
  COMMUNICATION_CHANNELS,
  PARTNER_TYPES,
} from '../constants/warehouse.constants';

/**
 * DTO para actualizar datos de un warehouse (sin incluir isActive)
 * El campo country NO es editable
 * Para cambiar isActive, usar el endpoint dedicado de activación
 */
export class UpdateWarehouseDataDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipCode?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactPerson?: string;

  @IsOptional()
  @IsEnum(COMMUNICATION_CHANNELS)
  canal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  additionalInfo?: string;

  @IsOptional()
  @IsEnum(PARTNER_TYPES)
  partnerType?: string;
}

