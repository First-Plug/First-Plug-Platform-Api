import {
  AttributeKey,
  Category,
  CATEGORY_KEYS,
  ValidationError,
} from '../interfaces/product.interface';

export function validateCategoryKeys(
  attributes: Array<{ key: AttributeKey }>,
  category: string,
): ValidationError | undefined {
  const keysForCategory = CATEGORY_KEYS[category];

  const attributeKeys = attributes.map((attr) => attr.key);
  const invalidKeys = attributeKeys.filter(
    (key) => !keysForCategory.includes(key),
  );

  if (invalidKeys.length > 0) {
    return {
      message: `Invalid key for the specified category: ${invalidKeys.join(', ')}`,
      path: ['attributes'],
    };
  }
}

/**
 * Valida valores de atributos
 * Ahora permite custom values además de los valores hardcodeados
 * Solo rechaza valores vacíos en atributos OBLIGATORIOS
 *
 * REGLAS DE ATRIBUTOS OBLIGATORIOS:
 * - Para Merchandising: NO hay atributos obligatorios (solo color es requerido como key)
 * - Para otras categorías: brand y model son SIEMPRE obligatorios
 *
 * @param attributes - Array de atributos a validar
 * @param category - Categoría del producto (opcional)
 * @returns Array de errores de validación (vacío si no hay errores)
 */
export function validateAttributeValues(
  attributes: Array<{ key: AttributeKey; value: string }>,
  category?: Category,
): Array<ValidationError> {
  const errors: Array<ValidationError> = [];

  // Para Merchandising, NO hay atributos con valores obligatorios
  // Solo color es requerido como KEY, pero puede tener valor vacío
  if (category === 'Merchandising') {
    return errors;
  }

  // Para otras categorías: brand y model son OBLIGATORIOS
  const requiredAttributes: Set<AttributeKey> = new Set(['brand', 'model']);

  for (const attr of attributes) {
    // Solo validar valores vacíos para atributos obligatorios
    if (requiredAttributes.has(attr.key)) {
      if (!attr.value || attr.value.trim() === '') {
        errors.push({
          message: `${attr.key} cannot be empty`,
          path: ['attributes'],
        });
        continue;
      }
    }

    // Nota: Ya no validamos contra listas hardcodeadas
    // Permitimos cualquier valor string (de lista o custom)
    // La validación de keys ya se hace en validateCategoryKeys()
  }

  return errors;
}
