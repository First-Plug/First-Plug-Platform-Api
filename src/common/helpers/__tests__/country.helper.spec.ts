import { CountryHelper } from '../country.helper';

describe('CountryHelper', () => {
  describe('isValidCountryCode', () => {
    it('should validate ISO country codes', () => {
      expect(CountryHelper.isValidCountryCode('AR')).toBe(true);
      expect(CountryHelper.isValidCountryCode('BR')).toBe(true);
      expect(CountryHelper.isValidCountryCode('US')).toBe(true);
      expect(CountryHelper.isValidCountryCode('CL')).toBe(true);
    });

    it('should validate special internal codes', () => {
      expect(CountryHelper.isValidCountryCode('OO')).toBe(true);
      expect(CountryHelper.isValidCountryCode('FP')).toBe(true);
    });

    it('should reject invalid codes', () => {
      expect(CountryHelper.isValidCountryCode('XX')).toBe(false);
      expect(CountryHelper.isValidCountryCode('ZZ')).toBe(false);
      expect(CountryHelper.isValidCountryCode('Argentina')).toBe(false);
      expect(CountryHelper.isValidCountryCode('Brazil')).toBe(false);
    });

    it('should handle case insensitive input', () => {
      expect(CountryHelper.isValidCountryCode('ar')).toBe(true);
      expect(CountryHelper.isValidCountryCode('br')).toBe(true);
      expect(CountryHelper.isValidCountryCode('oo')).toBe(true);
      expect(CountryHelper.isValidCountryCode('fp')).toBe(true);
    });

    it('should handle empty/null/undefined values', () => {
      expect(CountryHelper.isValidCountryCode('')).toBe(false);
      expect(CountryHelper.isValidCountryCode(null as any)).toBe(false);
      expect(CountryHelper.isValidCountryCode(undefined as any)).toBe(false);
    });
  });

  describe('normalizeCountryCode', () => {
    it('should normalize to uppercase and trim', () => {
      expect(CountryHelper.normalizeCountryCode('ar')).toBe('AR');
      expect(CountryHelper.normalizeCountryCode(' BR ')).toBe('BR');
      expect(CountryHelper.normalizeCountryCode('  oo  ')).toBe('OO');
    });

    it('should handle empty/null/undefined values', () => {
      expect(CountryHelper.normalizeCountryCode('')).toBe('');
      expect(CountryHelper.normalizeCountryCode(null as any)).toBe('');
      expect(CountryHelper.normalizeCountryCode(undefined as any)).toBe('');
    });
  });

  describe('validateAndNormalize', () => {
    it('should return normalized code for valid inputs', () => {
      expect(CountryHelper.validateAndNormalize('ar')).toBe('AR');
      expect(CountryHelper.validateAndNormalize(' BR ')).toBe('BR');
      expect(CountryHelper.validateAndNormalize('oo')).toBe('OO');
    });

    it('should return null for invalid inputs', () => {
      expect(CountryHelper.validateAndNormalize('XX')).toBe(null);
      expect(CountryHelper.validateAndNormalize('Argentina')).toBe(null);
      expect(CountryHelper.validateAndNormalize('')).toBe(null);
    });
  });

  describe('isSpecialInternalCode', () => {
    it('should identify special internal codes', () => {
      expect(CountryHelper.isSpecialInternalCode('OO')).toBe(true);
      expect(CountryHelper.isSpecialInternalCode('FP')).toBe(true);
      expect(CountryHelper.isSpecialInternalCode('oo')).toBe(true);
      expect(CountryHelper.isSpecialInternalCode('fp')).toBe(true);
    });

    it('should reject ISO codes', () => {
      expect(CountryHelper.isSpecialInternalCode('AR')).toBe(false);
      expect(CountryHelper.isSpecialInternalCode('BR')).toBe(false);
      expect(CountryHelper.isSpecialInternalCode('US')).toBe(false);
    });
  });

  describe('isISOCountryCode', () => {
    it('should identify ISO country codes', () => {
      expect(CountryHelper.isISOCountryCode('AR')).toBe(true);
      expect(CountryHelper.isISOCountryCode('BR')).toBe(true);
      expect(CountryHelper.isISOCountryCode('US')).toBe(true);
      expect(CountryHelper.isISOCountryCode('ar')).toBe(true);
    });

    it('should reject special internal codes', () => {
      expect(CountryHelper.isISOCountryCode('OO')).toBe(false);
      expect(CountryHelper.isISOCountryCode('FP')).toBe(false);
    });
  });
});
