import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { CountryHelper } from '../helpers/country.helper';

/**
 * Validador personalizado para códigos de país usando class-validator
 */
@ValidatorConstraint({ name: 'countryCode', async: false })
export class CountryCodeValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    // Permitir valores vacíos/null/undefined para campos opcionales
    if (!value || value === '') {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    return CountryHelper.isValidCountryCode(value);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Country must be a valid ISO 3166-1 alpha-2 code (e.g., AR, BR, US) or special internal code (OO, FP)';
  }
}
