import { z } from 'zod';
import validator from 'validator';

/**
 * Zod Schema para ComputerItem
 * Validación completa incluyendo reglas condicionales
 */
export const ComputerItemSchema = z
  .object({
    category: z.literal('Computer'),

    // STEP 2a: OS Selection
    os: z.enum(['macOS', 'Windows', 'Linux']).optional(),

    // STEP 2b: Datos específicos
    quantity: z
      .number()
      .int('Quantity debe ser un número entero')
      .positive('Quantity debe ser mayor a 0'),

    // Arrays de strings (opcionales - pueden estar vacíos)
    brand: z.array(z.string()).optional(),
    model: z.array(z.string()).optional(),
    processor: z.array(z.string()).optional(),
    ram: z.array(z.string()).optional(),
    storage: z.array(z.string()).optional(),
    screenSize: z.array(z.string()).optional(),

    otherSpecifications: z.string().optional(),

    // Checkboxes
    extendedWarranty: z.boolean().optional(),
    extendedWarrantyYears: z
      .number()
      .int('Extra years debe ser un número entero')
      .positive('Extra years debe ser mayor a 0')
      .optional(),
    deviceEnrollment: z.boolean().optional(),

    // STEP 3: Datos de entrega
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
  })
  .refine(
    (data) => {
      // Si extendedWarranty es true, extendedWarrantyYears es obligatorio
      if (data.extendedWarranty === true && !data.extendedWarrantyYears) {
        return false;
      }
      return true;
    },
    {
      message: 'Extra years es obligatorio si Extended Warranty está tildado',
      path: ['extendedWarrantyYears'],
    },
  );

export type ComputerItem = z.infer<typeof ComputerItemSchema>;
