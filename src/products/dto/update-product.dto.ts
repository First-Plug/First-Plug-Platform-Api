import { createZodDto } from '@anatine/zod-nestjs';
import { UpdateProductSchemaZod } from '../validations/create-product.zod';

export class UpdateProductDto extends createZodDto(UpdateProductSchemaZod) {}
