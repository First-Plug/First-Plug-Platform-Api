import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentsCoordinatorService } from './attachments-coordinator.service';
import { AttachmentsService } from './attachments.service';
import { JwtGuard } from '../auth/guard/jwt.guard';

/**
 * AttachmentsController
 * Endpoints para manejar adjuntos en IT Support services
 *
 * Flujo Opción A (Upload temporal):
 * 1. POST /quotes/:quoteId/services/it-support/attachments → sube imagen
 * 2. Front ve preview
 * 3. Si user hace submit → imagen ya está persistida
 * 4. Si user NO hace submit → imagen se borra después de X tiempo (cron)
 */
@Controller('quotes/:quoteId/services/it-support/attachments')
@UseGuards(JwtGuard)
export class AttachmentsController {
  constructor(
    private readonly coordinator: AttachmentsCoordinatorService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  /**
   * POST /quotes/:quoteId/services/it-support/attachments
   * Subir imagen (Opción A: upload temporal)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('quoteId') quoteId: string,
    @UploadedFile() file: any,
    @Req() req: any,
  ): Promise<any> {
    return this.coordinator.uploadAndPersist(quoteId, file);
  }

  /**
   * GET /quotes/:quoteId/services/it-support/attachments
   * Obtener attachments (para preview)
   */
  @Get()
  async getAttachments(
    @Param('quoteId') quoteId: string,
  ): Promise<any[]> {
    return this.attachmentsService.getAttachments(quoteId);
  }

  /**
   * DELETE /quotes/:quoteId/services/it-support/attachments/:publicId
   * Borrar imagen (antes de submit)
   */
  @Delete(':publicId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteImage(
    @Param('quoteId') quoteId: string,
    @Param('publicId') publicId: string,
  ): Promise<void> {
    return this.coordinator.deleteAttachment(quoteId, publicId);
  }
}

