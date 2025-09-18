import { z } from 'zod';
import { optionalCountryCodeSchema } from '../../common/validations/country.validation';

const phoneRegex = /^\+?[0-9\s]*$/;

export const UpdateTenantInformationSchemaZod = z.object({
  image: z.string().optional(),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, {
      message: 'Phone number is invalid',
    })
    .optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: optionalCountryCodeSchema,
  zipCode: z.string().trim().optional(),
  address: z.string().trim().optional(),
  apartment: z.string().trim().optional(),
});
