import { z } from 'zod';
import { ComputerItemSchema } from './computer-item.zod';
import {
  MonitorItemSchema,
  AudioItemSchema,
  PeripheralsItemSchema,
  MerchandisingItemSchema,
  OtherItemSchema,
} from './product-data.zod';

/**
 * Union de todos los tipos de productos
 * Usa z.union() en lugar de z.discriminatedUnion() porque ComputerItemSchema tiene .refine()
 */
const ProductUnion = z.union([
  ComputerItemSchema,
  MonitorItemSchema,
  AudioItemSchema,
  PeripheralsItemSchema,
  MerchandisingItemSchema,
  OtherItemSchema,
]);

/**
 * Zod Schema para CreateQuote DTO
 * Valida que al menos un producto esté presente
 * Soporta múltiples categorías de productos
 */
export const CreateQuoteSchema = z.object({
  products: z.array(ProductUnion).min(1, 'Al menos un producto es requerido'),
});

export type CreateQuoteDTO = z.infer<typeof CreateQuoteSchema>;
