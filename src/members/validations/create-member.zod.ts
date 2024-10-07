import { z } from 'zod';
import { ProductSchemaZod } from 'src/products/validations/create-product.zod';
import validator from 'validator';

const phoneRegex = /^\+?[0-9\s]*$/;

export const MemberSchemaZod = z.object({
  firstName: z.string().min(1, { message: 'First name is required' }).trim(),
  lastName: z.string().min(1, { message: 'Last name is required' }).trim(),
  email: z
    .string()
    .email({ message: 'Invalid email address' })
    .trim()
    .toLowerCase()
    .min(1, { message: 'Email is required' }),
  picture: z.string().optional(),
  position: z.string().trim().optional(),
  personalEmail: z.string().email().trim().toLowerCase().optional(),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, {
      message: 'Phone number is invalid',
    })
    .optional(),
  city: z.string().trim().optional(),
  // Contry list
  country: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
  address: z.string().trim().optional(),
  apartment: z.string().trim().optional(),
  additionalInfo: z.string().trim().optional(),
  startDate: z
    .string()
    .trim()
    .refine(validator.isISO8601, {
      message: 'Start date must be a valid ISO 8601 date',
    })
    .optional(),
  birthDate: z
    .string()
    .trim()
    .refine(validator.isISO8601)
    .optional()
    .nullable(),
  products: z.array(ProductSchemaZod).optional(),
  team: z.string().trim().optional(),
  dni: z
    .union([z.number().int().positive().or(z.literal(0)), z.undefined()])
    .optional(),
});

export const MemberSchemaZodArray = z.array(MemberSchemaZod);
