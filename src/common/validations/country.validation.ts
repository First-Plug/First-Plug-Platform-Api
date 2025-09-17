import { z } from 'zod';
import { CountryHelper } from '../helpers/country.helper';

/**
 * Validador Zod para códigos de país
 * Acepta códigos ISO 3166-1 alpha-2 y códigos especiales internos (OO, FP)
 */
export const countryCodeSchema = z
  .string()
  .trim()
  .transform((val) => CountryHelper.normalizeCountryCode(val))
  .refine(
    (code) => CountryHelper.isValidCountryCode(code),
    {
      message: 'Invalid country code. Must be a valid ISO 3166-1 alpha-2 code (e.g., AR, BR, US) or special internal code (OO, FP)',
    }
  );

/**
 * Validador opcional para códigos de país
 */
export const optionalCountryCodeSchema = countryCodeSchema.optional();

/**
 * Validador que permite string vacío o código válido
 */
export const countryCodeOrEmptySchema = z
  .string()
  .trim()
  .transform((val) => val === '' ? '' : CountryHelper.normalizeCountryCode(val))
  .refine(
    (code) => code === '' || CountryHelper.isValidCountryCode(code),
    {
      message: 'Invalid country code. Must be empty string or valid ISO 3166-1 alpha-2 code (e.g., AR, BR, US) or special internal code (OO, FP)',
    }
  );
