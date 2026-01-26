import { z } from 'zod';

// Productos disponibles
const PRODUCTS = [
  'Computer',
  'Monitor',
  'Audio',
  'Peripherals',
  'Merchandising',
  'Phone',
  'Furniture',
  'Tablet',
  'Other',
];

// Servicios disponibles
const SERVICES = [
  'IT Support',
  'Enrollment',
  'Data Wipe',
  'Destruction and Recycling',
  'Buyback',
  'Donate',
  'Cleaning',
  'Storage',
  'Offboarding',
  'Logistics',
];

/**
 * Base schema para productos
 */
const BaseProductSchema = z.object({
  category: z.enum(PRODUCTS as [string, ...string[]]),
  quantity: z.number().int().positive('Quantity must be positive'),
  country: z.string().length(2, 'Country must be ISO code'),
  city: z.string().optional(),
  deliveryDate: z.string().optional(),
  comments: z.string().optional(),
  otherSpecifications: z.string().optional(),
});

/**
 * Computer Product Schema
 */
const ComputerProductSchema = BaseProductSchema.extend({
  category: z.literal('Computer'),
  os: z.enum(['macOS', 'Windows', 'Linux']).optional(),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
  processor: z.array(z.string()).optional(),
  ram: z.array(z.string()).optional(),
  storage: z.array(z.string()).optional(),
  screenSize: z.array(z.string()).optional(),
  extendedWarranty: z.boolean().optional(),
  extendedWarrantyYears: z.number().int().positive().optional(),
  deviceEnrollment: z.boolean().optional(),
});

/**
 * Monitor Product Schema
 */
const MonitorProductSchema = BaseProductSchema.extend({
  category: z.literal('Monitor'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
  screenSize: z.array(z.string()).optional(),
  screenTechnology: z.string().optional(),
});

/**
 * Audio Product Schema
 */
const AudioProductSchema = BaseProductSchema.extend({
  category: z.literal('Audio'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
});

/**
 * Peripherals Product Schema
 */
const PeripheralsProductSchema = BaseProductSchema.extend({
  category: z.literal('Peripherals'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
  peripheralType: z.string().optional(),
});

/**
 * Phone Product Schema
 */
const PhoneProductSchema = BaseProductSchema.extend({
  category: z.literal('Phone'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
  os: z.enum(['iOS', 'Android']).optional(),
  storage: z.array(z.string()).optional(),
});

/**
 * Tablet Product Schema
 */
const TabletProductSchema = BaseProductSchema.extend({
  category: z.literal('Tablet'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
  screenSize: z.array(z.string()).optional(),
  os: z.enum(['iOS', 'Android', 'iPadOS']).optional(),
});

/**
 * Furniture Product Schema
 */
const FurnitureProductSchema = BaseProductSchema.extend({
  category: z.literal('Furniture'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
  furnitureType: z.string().optional(),
});

/**
 * Merchandising Product Schema
 */
const MerchandisingProductSchema = BaseProductSchema.extend({
  category: z.literal('Merchandising'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
  merchandiseType: z.string().optional(),
});

/**
 * Other Product Schema
 */
const OtherProductSchema = BaseProductSchema.extend({
  category: z.literal('Other'),
  brand: z.array(z.string()).optional(),
  model: z.array(z.string()).optional(),
  description: z.string().optional(),
});

/**
 * Union de todos los productos
 */
const ProductDataSchema = z.discriminatedUnion('category', [
  ComputerProductSchema,
  MonitorProductSchema,
  AudioProductSchema,
  PeripheralsProductSchema,
  PhoneProductSchema,
  TabletProductSchema,
  FurnitureProductSchema,
  MerchandisingProductSchema,
  OtherProductSchema,
]);

/**
 * Base schema para servicios
 */
const BaseServiceSchema = z.object({
  serviceCategory: z.enum(SERVICES as [string, ...string[]]),
  country: z.string().length(2, 'Country must be ISO code'),
  description: z.string().optional(),
  additionalDetails: z.string().optional(),
});

/**
 * IT Support Service Schema - Reparación/soporte de un producto específico
 */
const ITSupportServiceSchema = BaseServiceSchema.extend({
  serviceCategory: z.literal('IT Support'),
  productCategory: z.string().min(1, 'Product category is required'),
  productBrand: z.string().min(1, 'Product brand is required'),
  productModel: z.string().min(1, 'Product model is required'),
  issues: z.array(z.string()).min(1, 'At least one issue is required'),
  description: z.string().min(1, 'Description is required'),
  issueStartDate: z.string().optional(),
  impactLevel: z.enum(['low', 'medium', 'high']),
});

/**
 * Enrollment Service Schema
 */
const EnrollmentServiceSchema = BaseServiceSchema.extend({
  serviceCategory: z.literal('Enrollment'),
  numberOfDevices: z.number().int().positive().optional(),
  deviceTypes: z.array(z.string()).optional(),
  duration: z.string().optional(),
});

/**
 * Data Wipe Service Schema
 */
const DataWipeServiceSchema = BaseServiceSchema.extend({
  serviceCategory: z.literal('Data Wipe'),
  numberOfDevices: z.number().int().positive().optional(),
  deviceTypes: z.array(z.string()).optional(),
  certificateRequired: z.boolean().optional(),
});

/**
 * Destruction and Recycling Service Schema
 */
const DestructionServiceSchema = BaseServiceSchema.extend({
  serviceCategory: z.literal('Destruction and Recycling'),
  numberOfDevices: z.number().int().positive().optional(),
  deviceTypes: z.array(z.string()).optional(),
  certificateRequired: z.boolean().optional(),
});

/**
 * Buyback Service Schema
 */
const BuybackServiceSchema = BaseServiceSchema.extend({
  serviceCategory: z.literal('Buyback'),
  numberOfDevices: z.number().int().positive().optional(),
  deviceTypes: z.array(z.string()).optional(),
  estimatedValue: z.number().positive().optional(),
});

/**
 * Donate Service Schema
 */
const DonateServiceSchema = BaseServiceSchema.extend({
  serviceCategory: z.literal('Donate'),
  numberOfDevices: z.number().int().positive().optional(),
  deviceTypes: z.array(z.string()).optional(),
  donationOrganization: z.string().optional(),
});

/**
 * Cleaning Service Schema
 */
const CleaningServiceSchema = BaseServiceSchema.extend({
  serviceCategory: z.literal('Cleaning'),
  numberOfDevices: z.number().int().positive().optional(),
  cleaningType: z.enum(['Standard', 'Deep', 'Sanitization']).optional(),
});

/**
 * Storage Service Schema
 */
const StorageServiceSchema = BaseServiceSchema.extend({
  serviceCategory: z.literal('Storage'),
  numberOfDevices: z.number().int().positive().optional(),
  duration: z.string().optional(),
  storageLocation: z.string().optional(),
});

/**
 * Offboarding Service Schema
 */
const OffboardingServiceSchema = BaseServiceSchema.extend({
  serviceCategory: z.literal('Offboarding'),
  numberOfEmployees: z.number().int().positive().optional(),
  duration: z.string().optional(),
});

/**
 * Logistics Service Schema
 */
const LogisticsServiceSchema = BaseServiceSchema.extend({
  serviceCategory: z.literal('Logistics'),
  numberOfItems: z.number().int().positive().optional(),
  desirablePickupDate: z.string().optional(),
  destination: z.string().optional(),
});

/**
 * Union de todos los servicios
 */
const ServiceDataSchema = z.discriminatedUnion('serviceCategory', [
  ITSupportServiceSchema,
  EnrollmentServiceSchema,
  DataWipeServiceSchema,
  DestructionServiceSchema,
  BuybackServiceSchema,
  DonateServiceSchema,
  CleaningServiceSchema,
  StorageServiceSchema,
  OffboardingServiceSchema,
  LogisticsServiceSchema,
]);

export const CreatePublicQuoteSchema = z
  .object({
    email: z
      .string()
      .email('Email inválido')
      .refine(
        (email) => !email.endsWith('@firstplug.com'),
        'No se permiten emails de FirstPlug',
      ),
    fullName: z
      .string()
      .min(2, 'Nombre debe tener al menos 2 caracteres')
      .max(100, 'Nombre no puede exceder 100 caracteres')
      .trim(),
    companyName: z
      .string()
      .min(2, 'Empresa debe tener al menos 2 caracteres')
      .max(100, 'Empresa no puede exceder 100 caracteres')
      .trim(),
    country: z.string().length(2, 'País debe ser código ISO de 2 caracteres'),
    phone: z.string().optional(),
    requestType: z.enum(['product', 'service', 'mixed']),
    products: z.array(ProductDataSchema).optional(),
    services: z.array(ServiceDataSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.requestType === 'product' || data.requestType === 'mixed') {
        return data.products && data.products.length > 0;
      }
      return true;
    },
    {
      message:
        'Debe incluir al menos un producto si requestType es "product" o "mixed"',
      path: ['products'],
    },
  )
  .refine(
    (data) => {
      if (data.requestType === 'service' || data.requestType === 'mixed') {
        return data.services && data.services.length > 0;
      }
      return true;
    },
    {
      message:
        'Debe incluir al menos un servicio si requestType es "service" o "mixed"',
      path: ['services'],
    },
  );

export type CreatePublicQuoteInput = z.infer<typeof CreatePublicQuoteSchema>;
