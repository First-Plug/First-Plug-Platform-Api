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
 * Schemas para ubicaciones en Data Wipe
 */
const MemberLocationSchema = z.object({
  memberId: z.string().optional(),
  assignedMember: z.string().optional(),
  assignedEmail: z.string().email().optional(),
  countryCode: z.string().max(2).optional(),
});

const OfficeLocationSchema = z.object({
  officeId: z.string().optional(),
  officeName: z.string().optional(),
  countryCode: z.string().max(2).optional(),
});

const WarehouseLocationSchema = z.object({
  warehouseId: z.string().optional(),
  warehouseName: z.string().optional(),
  countryCode: z.string().max(2).optional(),
});

/**
 * Schema para destino de Data Wipe
 */
const DataWipeDestinationSchema = z.object({
  destinationType: z
    .enum(['Employee', 'Our office', 'FP warehouse'])
    .optional(),
  member: MemberLocationSchema.optional(),
  office: OfficeLocationSchema.optional(),
  warehouse: WarehouseLocationSchema.optional(),
});

/**
 * Schema para asset en Data Wipe
 */
const DataWipeAssetSchema = z.object({
  productId: z.string().optional(),
  productSnapshot: ProductSnapshotSchema.optional(),
  desirableDate: z
    .string()
    .refine(
      (val) => {
        // Validar formato YYYY-MM-DD
        return /^\d{4}-\d{2}-\d{2}$/.test(val);
      },
      {
        message: 'Desirable date debe estar en formato YYYY-MM-DD',
      },
    )
    .optional(),
  currentLocation: z
    .enum(['Employee', 'Our office', 'FP warehouse'])
    .optional(),
  currentMember: MemberLocationSchema.optional(),
  currentOffice: OfficeLocationSchema.optional(),
  currentWarehouse: WarehouseLocationSchema.optional(),
  destination: DataWipeDestinationSchema.optional(),
});

/**
 * Data Wipe Service Schema
 * Permite solicitar data wipe para múltiples assets
 */
export const DataWipeServiceSchema = z.object({
  serviceCategory: z.literal('Data Wipe'),
  productIds: z
    .array(z.string())
    .optional()
    .describe('IDs de los productos a hacer wipe (referencia)'),
  assets: z
    .array(DataWipeAssetSchema)
    .min(1, 'Al menos un asset es requerido para data wipe'),
  additionalDetails: z
    .string()
    .max(1000, 'Additional details no puede exceder 1000 caracteres')
    .optional(),
});

export type DataWipeService = z.infer<typeof DataWipeServiceSchema>;

/**
 * Schema para producto en Destruction and Recycling
 */
const DestructionProductSchema = z.object({
  productId: z.string().optional(),
  productSnapshot: ProductSnapshotSchema.optional(),
});

/**
 * Destruction and Recycling Service Schema
 * Permite solicitar destrucción y reciclaje de múltiples productos
 */
export const DestructionAndRecyclingServiceSchema = z.object({
  serviceCategory: z.literal('Destruction and Recycling'),
  productIds: z
    .array(z.string())
    .optional()
    .describe('IDs de los productos a destruir (referencia)'),
  products: z
    .array(DestructionProductSchema)
    .min(1, 'Al menos un producto es requerido para destrucción'),
  requiresCertificate: z
    .boolean()
    .default(false)
    .describe('¿Se requiere certificado de destrucción?'),
  comments: z
    .string()
    .max(1000, 'Comments no puede exceder 1000 caracteres')
    .optional(),
});

export type DestructionAndRecyclingService = z.infer<
  typeof DestructionAndRecyclingServiceSchema
>;

/**
 * Union de todos los servicios
 * Soporta IT Support, Enrollment, Data Wipe y Destruction and Recycling
 */
export const ServiceUnion = z.union([
  ITSupportServiceSchema,
  EnrollmentServiceSchema,
  DataWipeServiceSchema,
  DestructionAndRecyclingServiceSchema,
]);

/**
 * Zod Schema para CreateService DTO
 */
export const CreateServiceSchema = z.object({
  service: ServiceUnion,
});

export type CreateServiceDTO = z.infer<typeof CreateServiceSchema>;
