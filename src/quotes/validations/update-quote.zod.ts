import { z } from 'zod';
import { ComputerItemSchema } from './computer-item.zod';

/**
 * Zod Schema para UpdateQuote DTO
 * Permite actualizar productos o marcar como eliminado
 */
export const UpdateQuoteSchema = z.object({
  products: z
    .array(ComputerItemSchema)
    .min(1, 'Al menos un producto es requerido')
    .optional(),
  isDeleted: z.boolean().optional(),
});

export type UpdateQuoteDTO = z.infer<typeof UpdateQuoteSchema>;
