import { z } from 'zod';
import { ComputerItemSchema } from './computer-item.zod';

/**
 * Zod Schema para CreateQuote DTO
 * Valida que al menos un producto esté presente
 */
export const CreateQuoteSchema = z.object({
  products: z
    .array(ComputerItemSchema)
    .min(1, 'Al menos un producto es requerido'),
});

export type CreateQuoteDTO = z.infer<typeof CreateQuoteSchema>;
