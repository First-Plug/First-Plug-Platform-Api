import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

class ProductAttributeDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}

export class CreateProductForTenantDto {
  // === INFORMACIÓN DEL TENANT ===
  @IsString()
  @IsNotEmpty()
  tenantName: string; // Tenant donde crear el producto

  @IsString()
  @IsNotEmpty()
  warehouseCountryCode: string; // País del warehouse (AR, US, etc.)

  // === INFORMACIÓN DEL PRODUCTO ===
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeDto)
  attributes: ProductAttributeDto[];

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsString()
  @IsEnum(['Optimal', 'Good', 'Fair', 'Poor'])
  productCondition: string;

  @IsOptional()
  recoverable?: boolean;
}
