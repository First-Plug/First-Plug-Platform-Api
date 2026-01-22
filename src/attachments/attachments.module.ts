import { Module } from '@nestjs/common';
import { FileValidationService } from './services/file-validation.service';
import { AttachmentsGenericService } from './services/attachments-generic.service';

/**
 * AttachmentsModule - Módulo transversal para manejo de attachments
 *
 * Proporciona servicios reutilizables para:
 * - Validación de archivos (FileValidationService)
 * - Lógica genérica de attachments (AttachmentsGenericService)
 * - Helpers para Slack (SlackAttachmentsHelper)
 * - Upload a storage (Cloudinary, S3, etc.)
 * - Persistencia de metadata
 *
 * Usado por:
 * - QuotesModule (IT Support attachments)
 * - ShipmentsModule (futuro)
 * - OrdersModule (futuro)
 *
 * Arquitectura:
 * - Configuración centralizada en attachment.config.ts
 * - Servicios desacoplados y reutilizables
 * - Helpers estáticos para casos específicos
 */
@Module({
  providers: [FileValidationService, AttachmentsGenericService],
  exports: [FileValidationService, AttachmentsGenericService],
})
export class AttachmentsModule {}
