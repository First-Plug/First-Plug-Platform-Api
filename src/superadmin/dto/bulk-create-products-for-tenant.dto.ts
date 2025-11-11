import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';
import {
  CATEGORIES,
  ATTRIBUTES,
  CONDITION,
} from '../../products/interfaces/product.interface';
import { CURRENCY_CODES } from '../../products/validations/create-product.zod';

// Schema para cada instancia de producto específico
const ProductInstanceSchema = z.object({
  serialNumber: z
    .string()
    .transform((val) => val.toLowerCase())
    .optional()
    .nullable(),
  warehouseCountryCode: z
    .string()
    .min(1, { message: 'Warehouse country code is required for each product' }),
  additionalInfo: z.string().optional(),
});

// Schema principal para bulk create
const BulkCreateProductsForTenantSchema = z
  .object({
    // === INFORMACIÓN DEL TENANT ===
    tenantName: z.string().min(1, { message: 'Tenant name is required' }),

    // === INFORMACIÓN COMÚN DEL PRODUCTO ===
    name: z.string().optional(), // Opcional, se valida condicionalmente en superRefine
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
    productCondition: z.enum(CONDITION),
    recoverable: z.boolean().optional(),
    acquisitionDate: z.string().optional(),
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

    // === INFORMACIÓN ESPECÍFICA DE CADA PRODUCTO ===
    products: z
      .array(ProductInstanceSchema)
      .min(1, { message: 'At least one product is required' })
      .max(100, { message: 'Maximum 100 products allowed' }),

    // === VALIDACIÓN DE CANTIDAD ===
    quantity: z
      .number()
      .min(1, { message: 'Quantity must be at least 1' })
      .max(100, { message: 'Maximum 100 products allowed' }),
  })
  .superRefine((data, ctx) => {
    // 1. Validar que quantity coincida con products.length
    if (data.products.length !== data.quantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Quantity (${data.quantity}) must match the number of products provided (${data.products.length})`,
        path: ['quantity'],
      });
    }

    // 2. Validar serial numbers únicos dentro del request (solo los que no son null/undefined)
    const serialNumbers = data.products
      .map((p) => p.serialNumber)
      .filter((serial) => serial != null && serial !== '');
    const uniqueSerials = new Set(serialNumbers);
    if (
      serialNumbers.length > 0 &&
      uniqueSerials.size !== serialNumbers.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate serial numbers found in the request',
        path: ['products'],
      });
    }

    // 3. Name requerido solo para Merchandising
    if (data.category === 'Merchandising' && !data.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Name is required for Merchandising category.',
        path: ['name'],
      });
    }

    // 4. Brand y Model requeridos para categorías que no sean Merchandising
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
  });

export class BulkCreateProductsForTenantDto extends createZodDto(
  BulkCreateProductsForTenantSchema,
) {}
