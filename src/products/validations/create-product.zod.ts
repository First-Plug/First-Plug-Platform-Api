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
    actionType: z.enum(['return', 'relocate', 'assign', 'reassign']),
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
      .optional(),
    recoverable: z.boolean().optional(),
    assignedEmail: z.string().optional(),
    assignedMember: z.string().optional(),
    acquisitionDate: z.string().optional(),
    location: z.enum(LOCATIONS),
    status: z.enum(STATES),
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
    // if (data.category === 'Merchandising') {
    //   data.recoverable = false;
    // } else {
    //   data.recoverable = true;
    // }
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
