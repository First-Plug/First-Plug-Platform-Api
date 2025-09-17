/**
 * Country Helper - Maneja códigos de país de forma centralizada
 * 
 * Este helper solo trabaja con códigos ISO de país (AR, BR, US, etc.)
 * y códigos especiales internos (OO, FP).
 * 
 * El frontend es responsable de la conversión código → nombre para mostrar al usuario.
 */

export class CountryHelper {
  // Códigos ISO 3166-1 alpha-2 válidos
  private static readonly VALID_ISO_COUNTRY_CODES = [
    'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT',
    'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI',
    'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY',
    'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
    'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM',
    'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK',
    'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL',
    'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
    'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR',
    'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN',
    'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS',
    'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
    'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW',
    'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP',
    'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM',
    'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
    'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM',
    'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF',
    'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW',
    'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
    'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW'
  ];

  // Códigos especiales internos del sistema
  private static readonly SPECIAL_INTERNAL_CODES = [
    'OO', // Our office
    'FP', // FP warehouse
  ];

  /**
   * Obtiene todos los códigos válidos (ISO + especiales internos)
   */
  static getAllValidCodes(): string[] {
    return [
      ...this.VALID_ISO_COUNTRY_CODES,
      ...this.SPECIAL_INTERNAL_CODES
    ];
  }

  /**
   * Valida si un código de país es válido
   * @param code - Código a validar
   * @returns true si es válido
   */
  static isValidCountryCode(code: string): boolean {
    if (!code || typeof code !== 'string') {
      return false;
    }
    
    const normalizedCode = this.normalizeCountryCode(code);
    return this.getAllValidCodes().includes(normalizedCode);
  }

  /**
   * Normaliza un código de país (mayúsculas, trim)
   * @param code - Código a normalizar
   * @returns Código normalizado
   */
  static normalizeCountryCode(code: string): string {
    if (!code || typeof code !== 'string') {
      return '';
    }
    
    return code.trim().toUpperCase();
  }

  /**
   * Valida y normaliza un código de país
   * @param code - Código a procesar
   * @returns Código normalizado si es válido, null si no es válido
   */
  static validateAndNormalize(code: string): string | null {
    const normalized = this.normalizeCountryCode(code);
    return this.isValidCountryCode(normalized) ? normalized : null;
  }

  /**
   * Verifica si es un código especial interno
   * @param code - Código a verificar
   * @returns true si es un código especial interno
   */
  static isSpecialInternalCode(code: string): boolean {
    const normalized = this.normalizeCountryCode(code);
    return this.SPECIAL_INTERNAL_CODES.includes(normalized);
  }

  /**
   * Verifica si es un código ISO estándar
   * @param code - Código a verificar
   * @returns true si es un código ISO estándar
   */
  static isISOCountryCode(code: string): boolean {
    const normalized = this.normalizeCountryCode(code);
    return this.VALID_ISO_COUNTRY_CODES.includes(normalized);
  }
}
