import { z } from 'zod';

import {
  validateAttributeValues,
  validateCategoryKeys,
} from '../helpers/validation.helper';

import {
  CATEGORIES,
  CATEGORY_KEYS,
  ATTRIBUTES,
  STATES,
  LOCATIONS,
  CONDITION,
} from '../interfaces/product.interface';

export const CURRENCY_CODES = [
  'USD',
  'AED',
  'AFN',
  'ALL',
  'AMD',
  'ANG',
  'AOA',
  'ARS',
  'AUD',
  'AWG',
  'AZN',
  'BAM',
  'BBD',
  'BDT',
  'BGN',
  'BHD',
  'BIF',
  'BMD',
  'BND',
  'BOB',
  'BRL',
  'BSD',
  'BTN',
  'BWP',
  'BYN',
  'BZD',
  'CAD',
  'CDF',
  'CHF',
  'CLP',
  'CNY',
  'COP',
  'CRC',
  'CUP',
  'CVE',
  'CZK',
  'DJF',
  'DKK',
  'DOP',
  'DZD',
  'EGP',
  'ERN',
  'ETB',
  'EUR',
  'FJD',
  'GBP',
  'GEL',
  'GHS',
  'GMD',
  'GNF',
  'GTQ',
  'GYD',
  'HKD',
  'HNL',
  'HRK',
  'HTG',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'IQD',
  'IRR',
  'ISK',
  'JMD',
  'JOD',
  'JPY',
  'KES',
  'KGS',
  'KHR',
  'KMF',
  'KPW',
  'KRW',
  'KWD',
  'KYD',
  'KZT',
  'LAK',
  'LBP',
  'LKR',
  'LRD',
  'LSL',
  'LYD',
  'MAD',
  'MDL',
  'MGA',
  'MKD',
  'MMK',
  'MNT',
  'MOP',
  'MRU',
  'MUR',
  'MVR',
  'MWK',
  'MXN',
  'MYR',
  'MZN',
  'NAD',
  'NGN',
  'NIO',
  'NOK',
  'NPR',
  'NZD',
  'OMR',
  'PAB',
  'PEN',
  'PGK',
  'PHP',
  'PKR',
  'PLN',
  'PYG',
  'QAR',
  'RON',
  'RSD',
  'RUB',
  'RWF',
  'SAR',
  'SBD',
  'SCR',
  'SDG',
  'SEK',
  'SGD',
  'SLL',
  'SOS',
  'SRD',
  'STN',
  'SYP',
  'SZL',
  'THB',
  'TJS',
  'TMT',
  'TND',
  'TOP',
  'TRY',
  'TTD',
  'TWD',
  'TZS',
  'UAH',
  'UGX',
  'UYU',
  'UZS',
  'VES',
  'VND',
  'VUV',
  'WST',
  'XAF',
  'XCD',
  'XOF',
  'YER',
  'ZAR',
  'ZMW',
  'ZWL',
  'TBC',
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const ProductSchemaZod = z
  .object({
    actionType: z.enum(['return', 'relocate', 'assign', 'reassign']).optional(),
    name: z.string().optional(),
    category: z.enum(CATEGORIES),
    attributes: z
      .array(
        z.object({
          key: z.enum(ATTRIBUTES),
          value: z.string().optional().default(''),
        }),
      )
      .refine(
        (attrs) => {
          const keys = attrs.map((attr) => attr.key);
          return new Set(keys).size === keys.length;
        },
        {
          message: 'Attribute keys must be unique.',
        },
      ),
    serialNumber: z
      .string()
      .transform((val) => val.toLowerCase())
      .optional()
      .nullable(),
    recoverable: z.boolean().optional(),
    assignedEmail: z.string().optional(),
    assignedMember: z.string().optional(),
    acquisitionDate: z.string().optional(),
    location: z.enum(LOCATIONS),
    officeId: z.string().optional(),
    status: z.enum(STATES),
    additionalInfo: z.string().trim().optional(),
    productCondition: z.enum(CONDITION),
    price: z
      .object({
        amount: z
          .number()
          .min(0, { message: 'Amount must be non-negative' })
          .optional(),
        currencyCode: z
          .enum(CURRENCY_CODES, { message: 'Invalid currency code' })
          .optional(),
      })
      .partial()
      .refine(
        (data) =>
          (data.amount !== undefined && data.currencyCode !== undefined) ||
          (data.amount === undefined && data.currencyCode === undefined),
        {
          message:
            'Both amount and currencyCode must be defined if price is set',
          path: ['price'],
        },
      )
      .optional()
      .nullable(),
    fp_shipment: z.boolean().optional(),
    activeShipment: z.boolean().optional(),
    desirableDate: z
      .union([
        z.string(),
        z.object({
          origin: z.union([z.string(), z.date()]).optional(),
          destination: z.string().optional(),
        }),
      ])
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.category === 'Merchandising' && !data.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Name is required for Merchandising category.',
        path: ['name'],
      });
    }

    if (data.category !== 'Merchandising') {
      const attributeKeys = data.attributes.map((attr) => attr.key);
      if (!attributeKeys.includes('brand')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Brand is required for this category.',
          path: ['attributes'],
        });
      }
      if (!attributeKeys.includes('model')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Model is required for this category.',
          path: ['attributes'],
        });
      }
    }
    if (data.productCondition === 'Unusable') {
      if (data.status !== 'Unavailable') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'When product condition is Unusable, status must be Unavailable.',
          path: ['status'],
        });
      }
      // } else {
      //   if (data.fp_shipment) {
      //     if (
      //       typeof data.status !== 'string' ||
      //       !['In Transit', 'In Transit - Missing Data'].includes(data.status)
      //     ) {
      //       ctx.addIssue({
      //         code: z.ZodIssueCode.custom,
      //         message:
      //           "When FP handles the shipment, status must be 'In Transit' or 'In Transit - Missing Data'.",
      //         path: ['status'],
      //       });
      //     }
      // } else {
      //   // Validaciones para productos no "Unusable"
      //   if (data.assignedMember) {
      //     if (data.location !== 'Employee' || data.status !== 'Delivered') {
      //       ctx.addIssue({
      //         code: z.ZodIssueCode.custom,
      //         message:
      //           'When assigned to a member, location must be Employee and status must be Delivered.',
      //         path: ['status'],
      //       });
      //     }
      //   } else if (data.assignedEmail === 'none') {
      //     if (
      //       !['FP warehouse', 'Our office'].includes(data.location) ||
      //       data.status !== 'Available'
      //     ) {
      //       ctx.addIssue({
      //         code: z.ZodIssueCode.custom,
      //         message:
      //           'When unassigned, location must be FP warehouse or Our office, and status must be Available.',
      //         path: ['status'],
      //       });
      //     }
      //   }

      // Validación de condiciones de producto para ubicaciones específicas
      //     if (
      //       ['Employee', 'FP warehouse', 'Our office'].includes(data.location) &&
      //       !['Optimal', 'Defective'].includes(data.productCondition)
      //     ) {
      //       ctx.addIssue({
      //         code: z.ZodIssueCode.custom,
      //         message:
      //           'Product condition must be Optimal or Defective for the selected location.',
      //         path: ['productCondition'],
      //       });
      //     }
    }
  })
  .refine(
    (data) => {
      const category = data.category;
      const attributes = data.attributes;
      const categoryKeys = CATEGORY_KEYS[category];
      const presentKeys = attributes.map((attr) => attr.key);
      return categoryKeys.every((key) => presentKeys.includes(key));
    },
    (val) => {
      const category = val.category;
      const attributes = val.attributes;
      const categoryKeys = CATEGORY_KEYS[category];
      const presentKeys = attributes.map((attr) => attr.key);
      const missingKeys = categoryKeys.filter(
        (key) => !presentKeys.includes(key),
      );
      return {
        message: `are missing required keys for the selected category. (${missingKeys.join(',')})`,
        path: ['attributes'],
      };
    },
  )
  .refine(
    (data) => {
      const errors = validateCategoryKeys(data.attributes, data.category);
      return !errors;
    },
    (val) => {
      const errorMessages = validateCategoryKeys(val.attributes, val.category);
      return errorMessages!;
    },
  )
  .refine(
    (data) => {
      const errors = validateAttributeValues(data.attributes, data.category);
      return Object.keys(errors).length < 1;
    },
    (val) => {
      const errorMessages = validateAttributeValues(
        val.attributes,
        val.category,
      );

      return {
        message: `${errorMessages[0].message}`,
        path: [`${errorMessages[0].path}`],
      };
    },
  )
  .refine(
    (data) => {
      if (data.status === 'Available') {
        return ['FP warehouse', 'Our office'].includes(data.location);
      }
      if (data.status === 'Delivered') {
        return data.location === 'Employee';
      }

      return true;
    },
    (val) => {
      if (val.status === 'Available') {
        return {
          message:
            'must be FP warehouse or Our office when status is Available.',
          path: ['location'],
        };
      }
      if (val.status === 'Delivered') {
        return {
          message: 'must be Employee when status is Delivered.',
          path: ['location'],
        };
      }

      return {
        message: 'Invalid location for the given status.',
        path: ['location'],
      };
    },
  )
  .refine(
    (data) => {
      // Solo bloquear FP warehouse para creación inicial (sin actionType)
      // Permitir FP warehouse para updates/movimientos (con actionType)
      if (data.location === 'FP warehouse' && !data.actionType) {
        return false;
      }
      return true;
    },
    {
      message:
        'FP warehouse location is not allowed for initial product creation. Please use "Our office" instead.',
      path: ['location'],
    },
  );

// ✅ Schema específico para CSV con campos adicionales
export const ProductSchemaZodCSV = z
  .object({
    actionType: z.enum(['return', 'relocate', 'assign', 'reassign']).optional(),
    name: z.string().optional(),
    category: z.enum(CATEGORIES),
    attributes: z
      .array(
        z.object({
          key: z.enum(ATTRIBUTES),
          value: z.string().optional().default(''),
        }),
      )
      .refine(
        (attrs) => {
          const keys = attrs.map((attr) => attr.key);
          return new Set(keys).size === keys.length;
        },
        {
          message: 'Attribute keys must be unique.',
        },
      ),
    serialNumber: z
      .string()
      .transform((val) => val.toLowerCase())
      .optional()
      .nullable(),
    recoverable: z.boolean().optional(),
    assignedEmail: z.string().optional(),
    assignedMember: z.string().optional(),
    acquisitionDate: z.string().optional(),
    location: z.enum(LOCATIONS),
    officeId: z.string().optional(),
    status: z.enum(STATES),
    additionalInfo: z.string().trim().optional(),
    productCondition: z.enum(CONDITION),
    price: z
      .object({
        amount: z
          .number()
          .min(0, { message: 'Amount must be non-negative' })
          .optional(),
        currencyCode: z
          .enum(CURRENCY_CODES, { message: 'Invalid currency code' })
          .optional(),
      })
      .partial()
      .refine(
        (data) =>
          (data.amount !== undefined && data.currencyCode !== undefined) ||
          (data.amount === undefined && data.currencyCode === undefined),
        {
          message:
            'Both amount and currencyCode must be defined if price is set',
          path: ['price'],
        },
      )
      .optional()
      .nullable(),
    fp_shipment: z.boolean().optional(),
    activeShipment: z.boolean().optional(),
    desirableDate: z
      .union([
        z.string(),
        z.object({
          origin: z.union([z.string(), z.date()]).optional(),
          destination: z.string().optional(),
        }),
      ])
      .optional(),

    // 🆕 NUEVOS CAMPOS PARA CSV
    country: z.string().optional(),
    officeName: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // 🔍 VALIDACIÓN 1: Si assignedEmail se completa → location debe ser "Employee"
    if (data.assignedEmail && data.assignedEmail.trim() !== '') {
      if (data.location !== 'Employee') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'When assignedEmail is provided, location must be "Employee"',
          path: ['location'],
        });
      }
      // country y officeName deben estar vacíos/grisados cuando hay assignedEmail
      if (data.country && data.country.trim() !== '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Country should not be provided when assignedEmail is set (will be taken from employee data)',
          path: ['country'],
        });
      }
      if (data.officeName && data.officeName.trim() !== '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Office name should not be provided when assignedEmail is set',
          path: ['officeName'],
        });
      }
    }

    // 🔍 VALIDACIÓN 2: Si location es "FP Warehouse" → country requerido, officeName grisado
    if (data.location === 'FP warehouse') {
      if (!data.country || data.country.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Country is required when location is "FP warehouse"',
          path: ['country'],
        });
      }
      if (data.officeName && data.officeName.trim() !== '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Office name should not be provided for "FP warehouse" location',
          path: ['officeName'],
        });
      }
    }

    // 🔍 VALIDACIÓN 3: Si location es "Our Office" → country y officeName requeridos
    if (data.location === 'Our office') {
      if (!data.country || data.country.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Country is required when location is "Our office"',
          path: ['country'],
        });
      }
      if (!data.officeName || data.officeName.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Office name is required when location is "Our office"',
          path: ['officeName'],
        });
      }
    }

    // 🔍 VALIDACIÓN 4: Name requerido solo para Merchandising
    if (data.category === 'Merchandising' && !data.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Name is required for Merchandising category.',
        path: ['name'],
      });
    }
  })
  .refine(
    (data) => {
      if (data.status === 'Available') {
        return ['FP warehouse', 'Our office'].includes(data.location);
      }
      if (data.status === 'Delivered') {
        return data.location === 'Employee';
      }
      return true;
    },
    (val) => {
      if (val.status === 'Available') {
        return {
          message:
            'must be FP warehouse or Our office when status is Available.',
          path: ['location'],
        };
      }
      if (val.status === 'Delivered') {
        return {
          message: 'must be Employee when status is Delivered.',
          path: ['location'],
        };
      }
      return {
        message: 'Invalid location for the given status.',
        path: ['location'],
      };
    },
  );

export const ProductSchemaZodArray = z.array(ProductSchemaZod).refine(
  (products) => {
    // Validar que ningún producto tenga location "FP warehouse" en creación inicial
    const fpWarehouseProducts = products.filter(
      (product) => product.location === 'FP warehouse',
    );
    return fpWarehouseProducts.length === 0;
  },
  {
    message:
      'FP warehouse location is not allowed for initial product creation via CSV. Please use "Employee" instead.',
    path: ['location'],
  },
);

// ✅ Schema específico para arrays CSV con validaciones adicionales
export const ProductSchemaZodCSVArray = z.array(ProductSchemaZodCSV);
// ✅ REMOVIDO: Validación de "Our office" movida al service level
// Ahora manejamos esto con endpoints separados: /bulkcreate (UI) vs /bulkcreate-csv (CSV)

/**
 * Schema separado para updates de productos
 * Incluye todos los campos pero sin la validación de FP warehouse
 */
export const UpdateProductSchemaZod = z
  .object({
    actionType: z.enum(['return', 'relocate', 'assign', 'reassign']).optional(),
    name: z.string().optional(),
    category: z.enum(CATEGORIES).optional(),
    attributes: z
      .array(
        z.object({
          key: z.enum(ATTRIBUTES),
          value: z.string().optional().default(''),
        }),
      )
      .refine(
        (attrs) => {
          const keys = attrs.map((attr) => attr.key);
          return new Set(keys).size === keys.length;
        },
        {
          message: 'Attribute keys must be unique.',
        },
      )
      .optional(),
    serialNumber: z
      .string()
      .transform((val) => val.toLowerCase())
      .optional()
      .nullable(),
    recoverable: z.boolean().optional(),
    assignedEmail: z.string().optional(),
    assignedMember: z.string().optional(),
    acquisitionDate: z.string().optional(),
    location: z.enum(LOCATIONS).optional(), // ✅ Sin validación de FP warehouse
    officeId: z.string().optional(),
    status: z.enum(STATES).optional(),
    additionalInfo: z.string().trim().optional(),
    productCondition: z.enum(CONDITION).optional(),
    price: z
      .object({
        amount: z
          .number()
          .min(0, { message: 'Amount must be non-negative' })
          .optional(),
        currencyCode: z
          .enum(CURRENCY_CODES, { message: 'Invalid currency code' })
          .optional(),
      })
      .partial()
      .refine(
        (data) =>
          (data.amount !== undefined && data.currencyCode !== undefined) ||
          (data.amount === undefined && data.currencyCode === undefined),
        {
          message:
            'Both amount and currencyCode must be defined if price is set',
          path: ['price'],
        },
      )
      .optional()
      .nullable(),
    fp_shipment: z.boolean().optional(),
    activeShipment: z.boolean().optional(),
    desirableDate: z
      .union([
        z.string(),
        z.object({
          origin: z.union([z.string(), z.date()]).optional(),
          destination: z.string().optional(),
        }),
      ])
      .optional(),
  })
  .partial(); // ✅ Todos los campos opcionales
