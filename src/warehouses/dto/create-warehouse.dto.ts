import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import {
  COMMUNICATION_CHANNELS,
  PARTNER_TYPES,
} from '../constants/warehouse.constants';

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apartment?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  city: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  state: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  zipCode: string;

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
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  additionalInfo?: string;

  @IsOptional()
  @IsEnum(PARTNER_TYPES)
  partnerType?: string;

  @IsOptional()
  @IsBoolean()
  isRealPartner?: boolean;
}
