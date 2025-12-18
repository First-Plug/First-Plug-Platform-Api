import { z } from 'zod';
import validator from 'validator';

/**
 * Base schema compartido por todos los productos
 */
const BaseProductSchema = z.object({
  quantity: z
    .number()
    .int('Quantity debe ser un número entero')
    .positive('Quantity debe ser mayor a 0'),
  country: z
    .string()
    .min(1, 'Country es obligatorio')
    .max(2, 'Country debe ser un código ISO válido'),
  city: z.string().optional(),
  deliveryDate: z
    .string()
    .refine(validator.isISO8601, {
      message: 'Delivery date debe ser una fecha válida en formato ISO 8601',
    })
    .optional(),
  comments: z.string().optional(),
  otherSpecifications: z.string().optional(),
});

/**
 * Monitor Item Schema
 */
export const MonitorItemSchema = BaseProductSchema.extend({
  category: z.literal('Monitor'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
  screenSize: z.array(z.string()).optional(),
  screenTechnology: z.array(z.string()).optional(),
});

export type MonitorItem = z.infer<typeof MonitorItemSchema>;

/**
 * Audio Item Schema
 */
export const AudioItemSchema = BaseProductSchema.extend({
  category: z.literal('Audio'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
});

export type AudioItem = z.infer<typeof AudioItemSchema>;

/**
 * Peripherals Item Schema
 */
export const PeripheralsItemSchema = BaseProductSchema.extend({
  category: z.literal('Peripherals'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
});

export type PeripheralsItem = z.infer<typeof PeripheralsItemSchema>;

/**
 * Merchandising Item Schema
 */
export const MerchandisingItemSchema = BaseProductSchema.extend({
  category: z.literal('Merchandising'),
  description: z.string().optional(),
  additionalRequirements: z.string().optional(),
});

export type MerchandisingItem = z.infer<typeof MerchandisingItemSchema>;

/**
 * Phone Item Schema
 */
export const PhoneItemSchema = BaseProductSchema.extend({
  category: z.literal('Phone'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
  otherSpecifications: z.string().optional(),
});

export type PhoneItem = z.infer<typeof PhoneItemSchema>;

/**
 * Tablet Item Schema
 */
export const TabletItemSchema = BaseProductSchema.extend({
  category: z.literal('Tablet'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
  screenSize: z.array(z.string()).optional(),
  otherSpecifications: z.string().optional(),
});

export type TabletItem = z.infer<typeof TabletItemSchema>;

/**
 * Furniture Item Schema
 */
export const FurnitureItemSchema = BaseProductSchema.extend({
  category: z.literal('Furniture'),
  furnitureType: z.array(z.string()).optional(),
  otherSpecifications: z.string().optional(),
});

export type FurnitureItem = z.infer<typeof FurnitureItemSchema>;

/**
 * Other Item Schema
 */
export const OtherItemSchema = BaseProductSchema.extend({
  category: z.literal('Other'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
});

export type OtherItem = z.infer<typeof OtherItemSchema>;
