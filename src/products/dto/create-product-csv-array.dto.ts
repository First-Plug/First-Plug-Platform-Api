import { createZodDto } from '@anatine/zod-nestjs';
import { ProductSchemaZodCSVArray } from '../validations/create-product.zod';

export class CreateProductCSVArrayDto extends createZodDto(ProductSchemaZodCSVArray) {}
