/**
 * AttributeHelper
 * 
 * Proporciona funciones de utilidad para normalizar y procesar atributos de productos.
 * La normalización es crítica para:
 * - Agrupar productos por atributos (tableGrouping)
 * - Evitar fragmentación de datos (Apple vs APPLE vs apple)
 * - Mantener consistencia en búsquedas y filtros
 */

export class AttributeHelper {
  /**
   * Normaliza un valor de atributo
   * 
   * Aplica:
   * - trim(): Elimina espacios en blanco al inicio y final
   * - toLowerCase(): Convierte a minúsculas
   * 
   * Esto asegura que "Apple", "APPLE", " apple " se traten como el mismo valor
   * 
   * @param value - Valor a normalizar
   * @returns Valor normalizado
   */
  static normalizeValue(value: string): string {
    if (!value) {
      return '';
    }
    return value.trim().toLowerCase();
  }

  /**
   * Normaliza múltiples valores
   * 
   * @param values - Array de valores a normalizar
   * @returns Array de valores normalizados
   */
  static normalizeValues(values: string[]): string[] {
    return values.map((value) => this.normalizeValue(value));
  }

  /**
   * Crea una clave de agrupamiento normalizada para un producto
   * 
   * Útil para tableGrouping() donde necesitamos agrupar por brand + model
   * 
   * @param category - Categoría del producto
   * @param brand - Marca del producto
   * @param model - Modelo del producto
   * @returns Clave normalizada para agrupamiento
   */
  static createGroupingKey(
    category: string,
    brand: string,
    model: string,
  ): string {
    const normalizedBrand = this.normalizeValue(brand);
    const normalizedModel = this.normalizeValue(model);
    return JSON.stringify({
      category,
      brand: normalizedBrand,
      model: normalizedModel,
    });
  }
}

