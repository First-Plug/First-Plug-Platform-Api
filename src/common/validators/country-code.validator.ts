import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { CountryHelper } from '../helpers/country.helper';

/**
 * Validador personalizado para códigos de país o ubicaciones especiales usando class-validator
 */
@ValidatorConstraint({ name: 'countryCode', async: false })
export class CountryCodeValidator implements ValidatorConstraintInterface {
  validate(value: any) {
    // Permitir valores vacíos/null/undefined para campos opcionales
    if (!value || value === '') {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    // Permitir ubicaciones especiales
    if (CountryHelper.isSpecialLocation(value)) {
      return true;
    }

    // Validar códigos ISO
    const normalized = CountryHelper.normalizeCountryCode(value);
    return CountryHelper.isISOCountryCode(normalized);
  }

  defaultMessage() {
    return 'Country must be a valid ISO 3166-1 alpha-2 code (e.g., AR, BR, US) or special location (Our office, FP warehouse)';
  }
}
