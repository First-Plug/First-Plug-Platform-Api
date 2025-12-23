import { z } from 'zod';
import { ComputerItemSchema } from './computer-item.zod';
import {
  MonitorItemSchema,
  AudioItemSchema,
  PeripheralsItemSchema,
  MerchandisingItemSchema,
  PhoneItemSchema,
  TabletItemSchema,
  FurnitureItemSchema,
  OtherItemSchema,
} from './product-data.zod';
import { ServiceUnion } from './service.zod';

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
  PhoneItemSchema,
  TabletItemSchema,
  FurnitureItemSchema,
  OtherItemSchema,
]);

/**
 * Zod Schema para CreateQuote DTO
 * Valida que al menos un producto O un servicio esté presente
 * Soporta múltiples categorías de productos y servicios
 */
export const CreateQuoteSchema = z
  .object({
    products: z.array(ProductUnion).default([]),
    services: z.array(ServiceUnion).default([]),
  })
  .refine((data) => data.products.length > 0 || data.services.length > 0, {
    message: 'Al menos un producto o servicio es requerido',
    path: ['products'],
  });

export type CreateQuoteDTO = z.infer<typeof CreateQuoteSchema>;
