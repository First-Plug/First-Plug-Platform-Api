import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { AttachmentsService } from './attachments.service';

/**
 * AttachmentsCoordinatorService - SERVICIO TRANSVERSAL
 * Responsabilidad: Coordinar entre StorageService y AttachmentsService
 * - Valida archivo
 * - Sube a Cloudinary
 * - Persiste en Quote
 * - Maneja cleanup en caso de error
 */
@Injectable()
export class AttachmentsCoordinatorService {
  private readonly logger = new Logger(AttachmentsCoordinatorService.name);
  private readonly ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly EXPIRATION_DAYS = 30;

  constructor(
    private readonly storageService: StorageService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  /**
   * Flujo completo: validar → subir → persistir
   * Opción A: Upload temporal (para preview antes de submit)
   */
  async uploadAndPersist(
    quoteId: string,
    file: any,
  ): Promise<any> {
    try {
      // 1. Validar archivo
      this.validateFile(file);

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
          Date.now() + this.EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
        ),
      };

      // 4. Persistir en Quote
      await this.attachmentsService.addAttachment(quoteId, attachment);

      this.logger.log(
        `Attachment uploaded and persisted: ${uploadResult.publicId}`,
      );

      return attachment;
    } catch (error) {
      this.logger.error(
        `Error in uploadAndPersist: ${error.message}`,
      );
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
   * Validar archivo
   */
  private validateFile(file: any): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${this.ALLOWED_MIMES.join(', ')}`,
      );
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds ${this.MAX_FILE_SIZE / 1024 / 1024}MB limit`,
      );
    }
  }
}

