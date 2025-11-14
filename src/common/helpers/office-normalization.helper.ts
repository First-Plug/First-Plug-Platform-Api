/**
 * 🏢 Office Normalization Helper
 * Maneja la normalización de nombres de oficinas para búsquedas case-insensitive
 * y sin tildes/acentos para identificar oficinas existentes
 */

export class OfficeNormalizationHelper {
  /**
   * Normaliza un nombre de oficina para comparación
   * - Convierte a minúsculas
   * - Elimina tildes y acentos
   * - Elimina espacios extra
   * - Elimina caracteres especiales
   */
  static normalizeOfficeName(name: string): string {
    if (!name || typeof name !== 'string') {
      return '';
    }

    return name
      .trim()
      .toLowerCase()
      // Eliminar tildes y acentos
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Eliminar caracteres especiales excepto espacios, guiones y números
      .replace(/[^\w\s-]/g, '')
      // Normalizar espacios múltiples a uno solo
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Compara dos nombres de oficina de forma normalizada
   * @param name1 - Primer nombre a comparar
   * @param name2 - Segundo nombre a comparar
   * @returns true si los nombres son equivalentes
   */
  static areOfficeNamesEquivalent(name1: string, name2: string): boolean {
    const normalized1 = this.normalizeOfficeName(name1);
    const normalized2 = this.normalizeOfficeName(name2);
    return normalized1 === normalized2;
  }

  /**
   * Crea un regex para búsqueda case-insensitive de oficina
   * Útil para consultas MongoDB
   * @param name - Nombre de oficina a buscar
   * @returns RegExp para usar en consultas MongoDB
   */
  static createOfficeSearchRegex(name: string): RegExp {
    if (!name || typeof name !== 'string') {
      return new RegExp('', 'i');
    }

    // Escapar caracteres especiales de regex
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Crear regex case-insensitive
    return new RegExp(`^${escapedName}$`, 'i');
  }

  /**
   * Normaliza un código de país (similar a CountryHelper)
   * @param country - Código de país a normalizar
   * @returns Código normalizado en mayúsculas
   */
  static normalizeCountryCode(country: string): string {
    if (!country || typeof country !== 'string') {
      return '';
    }

    return country.trim().toUpperCase();
  }

  /**
   * Crea una clave única para identificar una oficina por país + nombre
   * Útil para detectar oficinas duplicadas en diferentes formatos
   * @param country - Código de país
   * @param officeName - Nombre de la oficina
   * @returns Clave única normalizada
   */
  static createOfficeKey(country: string, officeName: string): string {
    const normalizedCountry = this.normalizeCountryCode(country);
    const normalizedName = this.normalizeOfficeName(officeName);
    return `${normalizedCountry}:${normalizedName}`;
  }

  /**
   * Valida si un nombre de oficina es válido
   * @param name - Nombre a validar
   * @returns true si el nombre es válido
   */
  static isValidOfficeName(name: string): boolean {
    if (!name || typeof name !== 'string') {
      return false;
    }

    const trimmed = name.trim();
    
    // Debe tener al menos 1 carácter después del trim
    if (trimmed.length === 0) {
      return false;
    }

    // No debe ser solo espacios o caracteres especiales
    const normalized = this.normalizeOfficeName(trimmed);
    return normalized.length > 0;
  }
}
