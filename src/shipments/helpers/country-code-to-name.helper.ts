import { countryCodes } from './countryCodes';

const COUNTRY_CODE_TO_NAME: Record<string, string> = {};

Object.entries(countryCodes).forEach(([name, code]) => {
  COUNTRY_CODE_TO_NAME[code] = name;
});

/**
 * Convierte código de país a nombre para mostrar en Slack
 * @param countryCode - Código de país (AR, BR, etc.) o ubicación especial
 * @returns Nombre del país o la ubicación especial sin cambios
 */
export const convertCountryCodeToName = (countryCode: string): string => {
  if (!countryCode) return '';

  // Casos especiales que no se convierten
  if (countryCode === 'Our office' || countryCode === 'FP warehouse') {
    return countryCode;
  }

  // Si ya es un nombre (no código de 2 letras), devolverlo tal como está
  if (countryCode.length !== 2 || !/^[A-Z]{2}$/.test(countryCode)) {
    return countryCode;
  }

  // Convertir código a nombre
  return COUNTRY_CODE_TO_NAME[countryCode] || countryCode;
};
