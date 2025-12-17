import { createZodDto } from '@anatine/zod-nestjs';
import { CreateQuoteSchema } from '../validations/create-quote.zod';

/**
 * DTO para crear una nueva Quote
 * Generado automáticamente desde Zod schema
 */
export class CreateQuoteDto extends createZodDto(CreateQuoteSchema) {}
