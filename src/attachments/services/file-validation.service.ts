import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ATTACHMENT_CONFIG, AttachmentConfig } from '../config/attachment.config';

/**
 * FileValidationService - Validación centralizada de archivos
 * 
 * Responsabilidad:
 * - Validar MIME types
 * - Validar tamaño de archivos
 * - Validar extensiones
 * - Validar cantidad de archivos
 * 
 * Reutilizable en: Quotes, Shipments, Orders, etc.
 */
@Injectable()
export class FileValidationService {
  private readonly logger = new Logger(FileValidationService.name);

  /**
   * Validar un archivo individual
   * @param file - Archivo a validar (Express.Multer.File)
   * @param config - Configuración (usa ATTACHMENT_CONFIG por defecto)
   * @throws BadRequestException si la validación falla
   */
  validateFile(
    file: any,
    config: AttachmentConfig = ATTACHMENT_CONFIG,
  ): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.logger.debug(
      `File validation - Name: ${file.originalname}, MIME: ${file.mimetype}, Size: ${file.size}`,
    );

    // Validar extensión
    const filename = file.originalname?.toLowerCase() || '';
    const hasValidExtension = config.VALID_EXTENSIONS.some((ext) =>
      filename.endsWith(ext),
    );

    // Validar MIME type
    const hasValidMime = config.ALLOWED_MIMES.includes(file.mimetype);

    // Aceptar si tiene MIME type válido O extensión válida
    if (!hasValidMime && !hasValidExtension) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${config.ALLOWED_MIMES.join(', ')}. Got: ${file.mimetype || 'unknown'}`,
      );
    }

    // Validar tamaño
    if (file.size > config.MAX_FILE_SIZE) {
      const maxSizeMB = config.MAX_FILE_SIZE / 1024 / 1024;
      throw new BadRequestException(
        `File size exceeds ${maxSizeMB}MB limit`,
      );
    }

    this.logger.debug(`File validation passed for ${file.originalname}`);
  }

  /**
   * Validar múltiples archivos
   * @param files - Array de archivos a validar
   * @param config - Configuración (usa ATTACHMENT_CONFIG por defecto)
   * @throws BadRequestException si la validación falla
   */
  validateFiles(
    files: any[],
    config: AttachmentConfig = ATTACHMENT_CONFIG,
  ): void {
    if (!files || files.length === 0) {
      return; // Sin archivos es válido
    }

    // Validar cantidad
    if (files.length > config.MAX_FILES_PER_REQUEST) {
      throw new BadRequestException(
        `Maximum ${config.MAX_FILES_PER_REQUEST} files allowed per request`,
      );
    }

    // Validar cada archivo
    for (const file of files) {
      this.validateFile(file, config);
    }

    this.logger.debug(`All ${files.length} files validated successfully`);
  }
}

