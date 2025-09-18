import { z } from 'zod';
import { CountryHelper } from '../helpers/country.helper';

/**
 * Validador Zod para códigos de país o ubicaciones especiales
 * Acepta códigos ISO 3166-1 alpha-2 (AR, BR, US) o ubicaciones especiales (Our office, FP warehouse)
 */
export const countryCodeSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      // Permitir ubicaciones especiales sin modificar
      if (CountryHelper.isSpecialLocation(value)) {
        return true;
      }
      // Validar códigos ISO
      const normalized = CountryHelper.normalizeCountryCode(value);
      return CountryHelper.isISOCountryCode(normalized);
    },
    {
      message:
        'Invalid country. Must be a valid ISO 3166-1 alpha-2 code (e.g., AR, BR, US) or special location (Our office, FP warehouse)',
    },
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
  .refine(
    (value) => {
      if (value === '') return true;
      if (CountryHelper.isSpecialLocation(value)) return true;
      const normalized = CountryHelper.normalizeCountryCode(value);
      return CountryHelper.isISOCountryCode(normalized);
    },
    {
      message:
        'Invalid country. Must be empty string, valid ISO 3166-1 alpha-2 code (e.g., AR, BR, US) or special location (Our office, FP warehouse)',
    },
  );
