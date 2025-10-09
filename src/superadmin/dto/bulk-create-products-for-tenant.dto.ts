import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
  Min,
  Max,
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

class ProductInstanceDto {
  @IsString()
  @IsNotEmpty()
  serialNumber: string;

  @IsString()
  @IsNotEmpty()
  warehouseCountryCode: string; // País del warehouse para este producto específico

  @IsString()
  @IsOptional()
  additionalInfo?: string;
}

export class BulkCreateProductsForTenantDto {
  // === INFORMACIÓN DEL TENANT ===
  @IsString()
  @IsNotEmpty()
  tenantName: string; // Tenant donde crear los productos

  // === INFORMACIÓN COMÚN DEL PRODUCTO ===
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
  @IsEnum(['Optimal', 'Good', 'Fair', 'Poor'])
  productCondition: string;

  @IsOptional()
  recoverable?: boolean;

  @IsString()
  @IsOptional()
  acquisitionDate?: string;

  @IsOptional()
  price?: {
    amount: number;
    currencyCode: string;
  };

  // === INFORMACIÓN ESPECÍFICA DE CADA PRODUCTO ===
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductInstanceDto)
  products: ProductInstanceDto[]; // Array con serial number y warehouse para cada producto

  // === VALIDACIÓN DE CANTIDAD ===
  @IsNumber()
  @Min(1)
  @Max(100) // Límite razonable para bulk create
  quantity: number; // Debe coincidir con products.length
}
