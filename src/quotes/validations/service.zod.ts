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
 * Validación para detalles de Buyback
 */
const BuybackProductDetailsSchema = z.object({
  generalFunctionality: z
    .string()
    .max(500, 'General functionality no puede exceder 500 caracteres')
    .optional(),
  batteryCycles: z
    .number()
    .int('Battery cycles debe ser un número entero')
    .min(0, 'Battery cycles no puede ser negativo')
    .optional(),
  aestheticDetails: z
    .string()
    .max(1000, 'Aesthetic details no puede exceder 1000 caracteres')
    .optional(),
  hasCharger: z.boolean().optional(),
  chargerWorks: z.boolean().optional(),
  additionalComments: z
    .string()
    .max(1000, 'Additional comments no puede exceder 1000 caracteres')
    .optional(),
});

/**
 * Validación para producto en Buyback Service
 */
const BuybackProductSchema = z.object({
  productId: z.string().optional(),
  productSnapshot: ProductSnapshotSchema.optional(),
  buybackDetails: BuybackProductDetailsSchema.optional(),
});

/**
 * Validación para Buyback Service
 */
const BuybackServiceSchema = z.object({
  serviceCategory: z.literal('Buyback'),
  products: z
    .array(BuybackProductSchema)
    .min(1, 'Al menos un producto es requerido para buyback'),
  additionalInfo: z
    .string()
    .max(1000, 'Additional info no puede exceder 1000 caracteres')
    .optional(),
});

export type BuybackService = z.infer<typeof BuybackServiceSchema>;

/**
 * Validación para producto en Donate Service
 */
const DonateProductSchema = z.object({
  productId: z.string().optional(),
  productSnapshot: ProductSnapshotSchema.optional(),
  needsDataWipe: z
    .boolean()
    .describe('¿Necesita data wipe? (solo si category es Computer o Other)')
    .optional(),
  needsCleaning: z.boolean().describe('¿Necesita limpieza?').optional(),
  comments: z
    .string()
    .max(1000, 'Comments no puede exceder 1000 caracteres')
    .optional(),
});

/**
 * Validación para Donate Service
 * Permite solicitar donación de múltiples productos
 */
export const DonateServiceSchema = z.object({
  serviceCategory: z.literal('Donate'),
  products: z
    .array(DonateProductSchema)
    .min(1, 'Al menos un producto es requerido para donación'),
  additionalDetails: z
    .string()
    .max(1000, 'Additional details no puede exceder 1000 caracteres')
    .optional(),
});

export type DonateService = z.infer<typeof DonateServiceSchema>;

/**
 * Validación para producto en Cleaning Service
 */
const CleaningProductSchema = z.object({
  productId: z.string().optional(),
  productSnapshot: ProductSnapshotSchema.optional(),
  desiredDate: z
    .string()
    .refine(
      (val) => {
        // Validar formato YYYY-MM-DD
        return /^\d{4}-\d{2}-\d{2}$/.test(val);
      },
      {
        message: 'Desired date debe estar en formato YYYY-MM-DD',
      },
    )
    .optional(),
  cleaningType: z
    .enum(['Superficial', 'Deep'])
    .describe('Tipo de limpieza: Superficial o Deep')
    .optional(),
  additionalComments: z
    .string()
    .max(1000, 'Additional comments no puede exceder 1000 caracteres')
    .optional(),
});

/**
 * Validación para Cleaning Service
 * Permite solicitar limpieza de múltiples productos (Computer o Other)
 */
export const CleaningServiceSchema = z.object({
  serviceCategory: z.literal('Cleaning'),
  products: z
    .array(CleaningProductSchema)
    .min(1, 'Al menos un producto es requerido para limpieza'),
  additionalDetails: z
    .string()
    .max(1000, 'Additional details no puede exceder 1000 caracteres')
    .optional(),
});

export type CleaningService = z.infer<typeof CleaningServiceSchema>;

/**
 * Storage Product Schema
 */
const StorageProductSchema = z.object({
  productId: z.string().optional(),
  productSnapshot: ProductSnapshotSchema.optional(),
  approximateSize: z
    .string()
    .max(100, 'Approximate size no puede exceder 100 caracteres')
    .optional(),
  approximateWeight: z
    .string()
    .max(100, 'Approximate weight no puede exceder 100 caracteres')
    .optional(),
  approximateStorageDays: z
    .number()
    .int('Storage days debe ser un número entero')
    .positive('Storage days debe ser un número positivo')
    .optional(),
  additionalComments: z
    .string()
    .max(1000, 'Additional comments no puede exceder 1000 caracteres')
    .optional(),
});

/**
 * Storage Service Schema
 */
export const StorageServiceSchema = z.object({
  serviceCategory: z.literal('Storage'),
  products: z
    .array(StorageProductSchema)
    .min(1, 'Al menos un producto es requerido para almacenamiento'),
  additionalDetails: z
    .string()
    .max(1000, 'Additional details no puede exceder 1000 caracteres')
    .optional(),
});

export type StorageService = z.infer<typeof StorageServiceSchema>;

/**
 * Union de todos los servicios
 * Soporta IT Support, Enrollment, Data Wipe, Destruction and Recycling, Buyback, Donate, Cleaning y Storage
 */
export const ServiceUnion = z.union([
  ITSupportServiceSchema,
  EnrollmentServiceSchema,
  DataWipeServiceSchema,
  DestructionAndRecyclingServiceSchema,
  BuybackServiceSchema,
  DonateServiceSchema,
  CleaningServiceSchema,
  StorageServiceSchema,
]);

/**
 * Zod Schema para CreateService DTO
 */
export const CreateServiceSchema = z.object({
  service: ServiceUnion,
});

export type CreateServiceDTO = z.infer<typeof CreateServiceSchema>;
