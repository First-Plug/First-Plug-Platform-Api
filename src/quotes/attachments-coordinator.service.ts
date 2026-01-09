import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { AttachmentsService } from './attachments.service';
import { FileValidationService } from '../attachments/services/file-validation.service';
import { ATTACHMENT_CONFIG } from '../attachments/config/attachment.config';

/**
 * AttachmentsCoordinatorService - SERVICIO TRANSVERSAL
 * Responsabilidad: Coordinar entre StorageService y AttachmentsService
 * - Valida archivo (delegado a FileValidationService)
 * - Sube a Cloudinary
 * - Persiste en Quote
 * - Maneja cleanup en caso de error
 *
 * Arquitectura:
 * - Usa ATTACHMENT_CONFIG para configuración centralizada
 * - Delega validaciones a FileValidationService
 * - Reutilizable en otros módulos (Shipments, Orders, etc.)
 */
@Injectable()
export class AttachmentsCoordinatorService {
  private readonly logger = new Logger(AttachmentsCoordinatorService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly attachmentsService: AttachmentsService,
    private readonly fileValidation: FileValidationService,
  ) {}

  /**
   * Flujo completo: validar → subir → persistir
   * Opción A: Upload temporal (para preview antes de submit)
   *
   * Usa configuración centralizada de ATTACHMENT_CONFIG
   */
  async uploadAndPersist(quoteId: string, file: any): Promise<any> {
    try {
      // 1. Validar archivo (delegado a FileValidationService)
      this.fileValidation.validateFile(file);

      // 2. Subir a Cloudinary
      const uploadResult = await this.storageService.upload(file, {
        folder: `quotes/${quoteId}/it-support`,
        resourceType: 'image',
      });

      // 3. Crear objeto de attachment
      const attachment = {
        provider: uploadResult.provider,
        publicId: uploadResult.publicId,
        secureUrl: uploadResult.secureUrl,
        mimeType: uploadResult.mimeType,
        bytes: uploadResult.bytes,
        originalName: uploadResult.originalName,
        resourceType: uploadResult.resourceType,
        createdAt: new Date(),
        expiresAt: new Date(
          Date.now() + ATTACHMENT_CONFIG.EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
        ),
      };

      // 4. Persistir en Quote
      await this.attachmentsService.addAttachment(quoteId, attachment);

      this.logger.log(
        `Attachment uploaded and persisted: ${uploadResult.publicId}`,
      );

      return attachment;
    } catch (error) {
      this.logger.error(`Error in uploadAndPersist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Borrar attachment: remover de Quote + borrar de Cloudinary
   */
  async deleteAttachment(quoteId: string, publicId: string): Promise<void> {
    try {
      // 1. Remover de Quote
      await this.attachmentsService.removeAttachment(quoteId, publicId);

      // 2. Borrar de Cloudinary
      await this.storageService.delete(publicId);

      this.logger.log(`Attachment deleted: ${publicId}`);
    } catch (error) {
      this.logger.error(`Error deleting attachment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Limpiar attachments cuando quote es cancelada
   *
   * Qué hace:
   * 1. Obtiene todos los attachments de la quote
   * 2. Borra las imágenes de Cloudinary
   * 3. Vacía el array de attachments en Quote
   *
   * Qué NO hace:
   * - NO borra la quote (permanece como registro histórico)
   * - NO cambia el status (eso lo hace cancelQuoteWithCoordination)
   *
   * @param quoteId - ID de la quote
   */
  async cleanupAttachmentsOnCancel(quoteId: string): Promise<void> {
    try {
      // 1. Obtener todos los attachments
      const attachments = await this.attachmentsService.getAttachments(quoteId);

      if (attachments.length === 0) {
        this.logger.log(`No attachments to cleanup for quote ${quoteId}`);
        return;
      }

      // 2. Borrar cada uno de Cloudinary y remover de Quote
      for (const attachment of attachments) {
        try {
          // Borrar de Cloudinary
          await this.storageService.delete(attachment.publicId);

          // Remover de Quote (vacía el array)
          await this.attachmentsService.removeAttachment(
            quoteId,
            attachment.publicId,
          );

          this.logger.log(
            `Attachment cleaned up from quote ${quoteId}: ${attachment.publicId}`,
          );
        } catch (error) {
          this.logger.error(
            `Error cleaning up attachment ${attachment.publicId}: ${error.message}`,
          );
          // Continuar con los siguientes, no fallar todo
        }
      }

      this.logger.log(
        `All attachments cleaned up for quote ${quoteId} (${attachments.length} total)`,
      );
    } catch (error) {
      this.logger.error(
        `Error cleaning up attachments for quote ${quoteId}: ${error.message}`,
      );
      throw error;
    }
  }
}
