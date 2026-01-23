/**
 * Attachments Module - Índice de exports
 *
 * Exporta todos los servicios, helpers y configuración
 * para uso en otros módulos
 */

// Configuración
export { ATTACHMENT_CONFIG, getAttachmentConfig } from './config/attachment.config';
export type { AttachmentConfig } from './config/attachment.config';

// Servicios
export { FileValidationService } from './services/file-validation.service';
export { AttachmentsGenericService } from './services/attachments-generic.service';

// Helpers
export { SlackAttachmentsHelper } from './helpers/slack-attachments.helper';

// Módulo
export { AttachmentsModule } from './attachments.module';

