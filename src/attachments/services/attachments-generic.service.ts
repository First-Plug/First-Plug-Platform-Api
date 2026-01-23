import { Injectable, Logger } from '@nestjs/common';
import { ATTACHMENT_CONFIG } from '../config/attachment.config';

/**
 * AttachmentsGenericService - Servicio genérico reutilizable
 *
 * Responsabilidad: Lógica común para manejo de attachments
 * - Construcción de objetos attachment
 * - Cálculo de expiración
 * - Formateo de respuestas
 *
 * Reutilizable en: Quotes, Shipments, Orders, etc.
 *
 * Patrón de uso:
 * 1. Validar archivos con FileValidationService
 * 2. Subir a storage (Cloudinary, S3, etc.)
 * 3. Construir objeto attachment con buildAttachment()
 * 4. Persistir en entidad
 */
@Injectable()
export class AttachmentsGenericService {
  private readonly logger = new Logger(AttachmentsGenericService.name);

  /**
   * Construir objeto attachment a partir de resultado de upload
   * Incluye metadata, timestamps y expiración
   *
   * @param uploadResult - Resultado del upload a storage
   * @returns Objeto attachment completo
   */
  buildAttachment(uploadResult: any): {
    provider: string;
    publicId: string;
    secureUrl: string;
    mimeType: string;
    bytes: number;
    originalName?: string;
    resourceType?: string;
    createdAt: Date;
    expiresAt: Date;
  } {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + ATTACHMENT_CONFIG.EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
    );

    return {
      provider: uploadResult.provider,
      publicId: uploadResult.publicId,
      secureUrl: uploadResult.secureUrl,
      mimeType: uploadResult.mimeType,
      bytes: uploadResult.bytes,
      originalName: uploadResult.originalName,
      resourceType: uploadResult.resourceType,
      createdAt: now,
      expiresAt,
    };
  }

  /**
   * Calcular fecha de expiración
   * @returns Fecha de expiración basada en ATTACHMENT_CONFIG
   */
  calculateExpirationDate(): Date {
    return new Date(
      Date.now() + ATTACHMENT_CONFIG.EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
    );
  }

  /**
   * Formatear attachment para respuesta API
   * Oculta información sensible si es necesario
   *
   * @param attachment - Objeto attachment
   * @returns Attachment formateado para respuesta
   */
  formatAttachmentForResponse(attachment: any): any {
    return {
      publicId: attachment.publicId,
      secureUrl: attachment.secureUrl,
      mimeType: attachment.mimeType,
      bytes: attachment.bytes,
      originalName: attachment.originalName,
      createdAt: attachment.createdAt,
      expiresAt: attachment.expiresAt,
    };
  }

  /**
   * Validar si attachment está expirado
   * @param attachment - Objeto attachment
   * @returns true si está expirado
   */
  isExpired(attachment: any): boolean {
    return new Date() > new Date(attachment.expiresAt);
  }

  /**
   * Obtener días restantes hasta expiración
   * @param attachment - Objeto attachment
   * @returns Número de días restantes
   */
  getDaysUntilExpiration(attachment: any): number {
    const now = new Date();
    const expiresAt = new Date(attachment.expiresAt);
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
}

