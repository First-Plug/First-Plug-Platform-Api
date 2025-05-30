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

const CURRENCY_CODES = [
  'USD',
  'ARS',
  'BOB',
  'BRL',
  'CLP',
  'COP',
  'CRC',
  'GTQ',
  'HNL',
  'ILS',
  'MXN',
  'NIO',
  'PAB',
  'PEN',
  'PYG',
  'EUR',
  'UYU',
  'VES',
] as const;

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
            'must be FP warehouse, or Our office when status is Available.',
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

export const ProductSchemaZodArray = z.array(ProductSchemaZod);
