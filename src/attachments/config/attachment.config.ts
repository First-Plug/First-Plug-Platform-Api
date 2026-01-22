/**
 * Configuración centralizada para attachments
 *
 * Cambiar límites aquí afecta a todos los módulos que usan attachments
 * (Quotes, Shipments, Orders, etc.)
 */

export interface AttachmentConfig {
  ALLOWED_MIMES: string[];
  MAX_FILE_SIZE: number;
  EXPIRATION_DAYS: number;
  MAX_FILES_PER_REQUEST: number;
  STORAGE_FOLDER_PREFIX: string;
  VALID_EXTENSIONS: string[];
}

export const ATTACHMENT_CONFIG: AttachmentConfig = {
  // Formatos de imagen permitidos
  ALLOWED_MIMES: ['image/jpeg', 'image/png', 'image/webp'],

  // Tamaño máximo por archivo: 10MB
  MAX_FILE_SIZE: 10 * 1024 * 1024,

  // Expiración de attachments: 30 días
  EXPIRATION_DAYS: 30,

  // Máximo de archivos por request
  MAX_FILES_PER_REQUEST: 10,

  // Prefijo para carpetas en storage
  // Ejemplo: attachments/quotes, attachments/shipments
  STORAGE_FOLDER_PREFIX: 'attachments',

  // Extensiones válidas (validación adicional)
  VALID_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
};

/**
 * Función helper para obtener config con overrides
 * Útil para módulos que quieren límites diferentes
 *
 * Ejemplo:
 * const shipmentConfig = getAttachmentConfig({ MAX_FILES_PER_REQUEST: 5 });
 */
export function getAttachmentConfig(
  overrides?: Partial<AttachmentConfig>,
): AttachmentConfig {
  return {
    ...ATTACHMENT_CONFIG,
    ...overrides,
  };
}
