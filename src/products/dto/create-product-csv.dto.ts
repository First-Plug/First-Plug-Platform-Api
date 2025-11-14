import { createZodDto } from '@anatine/zod-nestjs';
import { ProductSchemaZodCSV } from '../validations/create-product.zod';

export class CreateProductCSVDto extends createZodDto(ProductSchemaZodCSV) {}
