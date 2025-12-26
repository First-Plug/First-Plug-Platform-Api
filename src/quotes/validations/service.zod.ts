import { z } from 'zod';

/**
 * Validación para ProductSnapshot
 */
const ProductSnapshotSchema = z.object({
  category: z.string().optional(),
  name: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
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
 * Enrollment Service Schema
 * Permite enrollar múltiples dispositivos
 */
export const EnrollmentServiceSchema = z.object({
  serviceCategory: z.literal('Enrollment'),
  productIds: z
    .array(z.string())
    .optional()
    .describe('IDs de los productos a enrollar (referencia)'),
  enrolledDevices: z
    .array(ProductSnapshotSchema)
    .min(1, 'Al menos un dispositivo es requerido para enrollar'),
  additionalDetails: z
    .string()
    .max(1000, 'Additional details no puede exceder 1000 caracteres')
    .optional(),
});

export type EnrollmentService = z.infer<typeof EnrollmentServiceSchema>;

/**
 * Union de todos los servicios
 * Soporta IT Support y Enrollment
 */
export const ServiceUnion = z.union([
  ITSupportServiceSchema,
  EnrollmentServiceSchema,
]);

/**
 * Zod Schema para CreateService DTO
 */
export const CreateServiceSchema = z.object({
  service: ServiceUnion,
});

export type CreateServiceDTO = z.infer<typeof CreateServiceSchema>;
