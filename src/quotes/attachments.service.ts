import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Quote, QuoteDocument } from './schemas/quote.schema';

/**
 * AttachmentsService - SERVICIO RAÍZ
 * Responsabilidad: CRUD de attachments en Quote.services[].attachments
 * NO coordina con StorageService (eso es responsabilidad del coordinador)
 */
@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    @Inject('QUOTE_MODEL') private quoteRepository: Model<QuoteDocument>,
  ) {}

  /**
   * Agregar attachment a IT Support service
   * @param quoteId - ID de la quote
   * @param attachmentData - datos del attachment (ya subido a Cloudinary)
   * @returns attachment guardado
   */
  async addAttachment(
    quoteId: string,
    attachmentData: any,
  ): Promise<any> {
    try {
      if (!Types.ObjectId.isValid(quoteId)) {
        throw new BadRequestException('Invalid quote ID');
      }

      const quote = await this.quoteRepository.findById(quoteId);
      if (!quote) {
        throw new NotFoundException('Quote not found');
      }

      const itSupportService = quote.services?.find(
        (s: any) => s.serviceCategory === 'IT Support',
      );
      if (!itSupportService) {
        throw new BadRequestException(
          'No IT Support service found in this quote',
        );
      }

      itSupportService.attachments = itSupportService.attachments || [];
      if (itSupportService.attachments.length >= 4) {
        throw new BadRequestException('Maximum 4 attachments allowed');
      }

      itSupportService.attachments.push(attachmentData);
      await quote.save();

      this.logger.log(
        `Attachment added to quote ${quoteId}: ${attachmentData.publicId}`,
      );

      return attachmentData;
    } catch (error) {
      this.logger.error(`Error adding attachment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remover attachment de IT Support service
   * @param quoteId - ID de la quote
   * @param publicId - ID público del recurso
   */
  async removeAttachment(quoteId: string, publicId: string): Promise<void> {
    try {
      if (!Types.ObjectId.isValid(quoteId)) {
        throw new BadRequestException('Invalid quote ID');
      }

      const quote = await this.quoteRepository.findById(quoteId);
      if (!quote) {
        throw new NotFoundException('Quote not found');
      }

      const itSupportService = quote.services?.find(
        (s: any) => s.serviceCategory === 'IT Support',
      );
      if (!itSupportService) {
        throw new BadRequestException(
          'No IT Support service found in this quote',
        );
      }

      const index = itSupportService.attachments?.findIndex(
        (a: any) => a.publicId === publicId,
      );
      if (index === -1 || index === undefined) {
        throw new NotFoundException('Attachment not found');
      }

      itSupportService.attachments.splice(index, 1);
      await quote.save();

      this.logger.log(
        `Attachment removed from quote ${quoteId}: ${publicId}`,
      );
    } catch (error) {
      this.logger.error(`Error removing attachment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtener attachments de IT Support service
   */
  async getAttachments(quoteId: string): Promise<any[]> {
    try {
      if (!Types.ObjectId.isValid(quoteId)) {
        throw new BadRequestException('Invalid quote ID');
      }

      const quote = await this.quoteRepository.findById(quoteId);
      if (!quote) {
        throw new NotFoundException('Quote not found');
      }

      const itSupportService = quote.services?.find(
        (s: any) => s.serviceCategory === 'IT Support',
      );

      return itSupportService?.attachments || [];
    } catch (error) {
      this.logger.error(`Error getting attachments: ${error.message}`);
      throw error;
    }
  }
}

