import { createZodDto } from '@anatine/zod-nestjs';
import { UpdateQuoteSchema } from '../validations/update-quote.zod';

/**
 * DTO para actualizar una Quote existente
 * Generado automáticamente desde Zod schema
 */
export class UpdateQuoteDto extends createZodDto(UpdateQuoteSchema) {}

