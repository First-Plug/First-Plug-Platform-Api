import { z } from 'zod';

/**
 * Validación para ProductSnapshot
 */
const ProductSnapshotSchema = z.object({
  serialNumber: z.string().optional(),
  location: z.string().optional(),
  assignedTo: z.string().optional(),
  countryCode: z
    .string()
    .max(2, 'Country code debe ser un código ISO válido')
    .optional(),
});

/**
 * Base schema compartido por todos los servicios
 */
const BaseServiceSchema = z.object({
  productId: z.string().optional(), // MongoDB ObjectId como string
  productSnapshot: ProductSnapshotSchema.optional(),
  issues: z
    .array(z.string())
    .min(1, 'Al menos un issue es requerido')
    .max(10, 'Máximo 10 issues permitidos'),
  description: z
    .string()
    .min(1, 'Description es requerido')
    .max(1000, 'Description no puede exceder 1000 caracteres'),
  issueStartDate: z
    .string()
    .refine(
      (val) => {
        // Validar formato YYYY-MM-DD
        return /^\d{4}-\d{2}-\d{2}$/.test(val);
      },
      {
        message: 'Issue start date debe estar en formato YYYY-MM-DD',
      },
    )
    .optional(),
  impactLevel: z.enum(['low', 'medium', 'high']),
});

/**
 * IT Support Service Schema
 */
export const ITSupportServiceSchema = BaseServiceSchema.extend({
  serviceCategory: z.literal('IT Support'),
});

export type ITSupportService = z.infer<typeof ITSupportServiceSchema>;

/**
 * Por ahora solo IT Support, pero preparado para extensión
 * Cuando haya más servicios, cambiar a z.union([...])
 */
export const ServiceUnion = ITSupportServiceSchema;

/**
 * Zod Schema para CreateService DTO
 */
export const CreateServiceSchema = z.object({
  service: ServiceUnion,
});

export type CreateServiceDTO = z.infer<typeof CreateServiceSchema>;
