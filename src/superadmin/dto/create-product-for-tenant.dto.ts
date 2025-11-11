import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';
import {
  CATEGORIES,
  ATTRIBUTES,
  CONDITION,
} from '../../products/interfaces/product.interface';
import { CURRENCY_CODES } from '../../products/validations/create-product.zod';

// Schema específico para SuperAdmin que extiende las validaciones del usuario
const CreateProductForTenantSchema = z
  .object({
    // === INFORMACIÓN DEL TENANT ===
    tenantName: z.string().min(1, { message: 'Tenant name is required' }),
    warehouseCountryCode: z
      .string()
      .min(1, { message: 'Warehouse country code is required' }),

    // === INFORMACIÓN DEL PRODUCTO ===
    // Usar las mismas validaciones que el usuario para el producto
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
    serialNumber: z
      .string()
      .transform((val) => val.toLowerCase())
      .optional()
      .nullable(),
    productCondition: z.enum(CONDITION),
    recoverable: z.boolean().optional(),

    // === CAMPOS ADICIONALES PARA SUPERADMIN ===
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
    additionalInfo: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Aplicar las mismas validaciones que el usuario

    // 1. Name requerido solo para Merchandising
    if (data.category === 'Merchandising' && !data.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Name is required for Merchandising category.',
        path: ['name'],
      });
    }

    // 2. Brand y Model requeridos para categorías que no sean Merchandising
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

export class CreateProductForTenantDto extends createZodDto(
  CreateProductForTenantSchema,
) {}
