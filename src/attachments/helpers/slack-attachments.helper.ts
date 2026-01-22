/**
 * SlackAttachmentsHelper - Helper para formatear attachments en mensajes Slack
 *
 * Responsabilidad: Construir bloques de imágenes para Slack
 * - Formatear URLs de imágenes
 * - Construir bloques de imagen
 * - Manejar múltiples imágenes
 *
 * Reutilizable en: Quotes, Shipments, Orders, etc.
 *
 * Patrón de uso:
 * const imageBlocks = SlackAttachmentsHelper.buildImageBlocks(attachments);
 * message.blocks.push(...imageBlocks);
 */

export class SlackAttachmentsHelper {
  /**
   * Construir bloques de imagen para Slack
   * Cada imagen se muestra en su propio bloque
   *
   * @param attachments - Array de attachments
   * @returns Array de bloques de imagen para Slack
   */
  static buildImageBlocks(attachments: any[]): any[] {
    if (!attachments || attachments.length === 0) {
      return [];
    }

    return attachments.map((attachment) => ({
      type: 'image',
      image_url: attachment.secureUrl,
      alt_text: attachment.originalName || 'Attachment image',
    }));
  }

  /**
   * Construir bloque de sección con información de attachments
   * Muestra cantidad y tamaño total
   *
   * @param attachments - Array de attachments
   * @returns Bloque de sección con información
   */
  static buildAttachmentInfoBlock(attachments: any[]): any {
    if (!attachments || attachments.length === 0) {
      return null;
    }

    const totalSize = attachments.reduce((sum, a) => sum + a.bytes, 0);
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📎 *Attachments:* ${attachments.length} file(s) • ${totalSizeMB}MB`,
      },
    };
  }

  /**
   * Construir bloque de contexto con detalles de attachments
   * Muestra nombres de archivos y fechas
   *
   * @param attachments - Array de attachments
   * @returns Bloque de contexto con detalles
   */
  static buildAttachmentDetailsBlock(attachments: any[]): any {
    if (!attachments || attachments.length === 0) {
      return null;
    }

    const details = attachments
      .map((a) => {
        const date = new Date(a.createdAt).toLocaleDateString();
        return `• ${a.originalName || 'File'} (${date})`;
      })
      .join('\n');

    return {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: details,
        },
      ],
    };
  }

  /**
   * Construir bloques completos para Slack
   * Incluye información, detalles e imágenes
   *
   * @param attachments - Array de attachments
   * @returns Array de bloques listos para Slack
   */
  static buildCompleteAttachmentBlocks(attachments: any[]): any[] {
    const blocks: any[] = [];

    // Agregar bloque de información
    const infoBlock = this.buildAttachmentInfoBlock(attachments);
    if (infoBlock) {
      blocks.push(infoBlock);
    }

    // Agregar bloque de detalles
    const detailsBlock = this.buildAttachmentDetailsBlock(attachments);
    if (detailsBlock) {
      blocks.push(detailsBlock);
    }

    // Agregar bloques de imágenes
    const imageBlocks = this.buildImageBlocks(attachments);
    blocks.push(...imageBlocks);

    return blocks;
  }

  /**
   * Validar si hay attachments para mostrar
   * @param attachments - Array de attachments
   * @returns true si hay attachments válidos
   */
  static hasAttachments(attachments: any[]): boolean {
    return Array.isArray(attachments) && attachments.length > 0;
  }
}

