import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { QuotesService } from './quotes.service';
import { SlackService } from '../slack/slack.service';
import { HistoryService } from '../history/history.service';
import { CreateQuoteDto } from './dto';
import { Quote } from './interfaces/quote.interface';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { HistorySchema } from 'src/history/schemas/history.schema';
import { CreateQuoteMessageToSlack } from './helpers/create-quote-message-to-slack';

/**
 * QuotesCoordinatorService - Servicio Transversal
 * Responsabilidad: Coordinación entre QuotesService y servicios auxiliares
 * - Notificaciones a Slack
 * - Auditoría en History
 * - Lógica de negocio compleja
 */
@Injectable()
export class QuotesCoordinatorService {
  private readonly logger = new Logger(QuotesCoordinatorService.name);

  constructor(
    readonly quotesService: QuotesService,
    private readonly slackService: SlackService,
    private readonly historyService: HistoryService,
    private readonly tenantConnectionService: TenantConnectionService,
  ) {}

  /**
   * Crear quote con coordinación de servicios
   * 1. Crear quote en BD
   * 2. Notificar a Slack (no-blocking)
   * 3. Registrar en History
   */
  async createQuoteWithCoordination(
    createQuoteDto: CreateQuoteDto,
    tenantId: Types.ObjectId,
    tenantName: string,
    userEmail: string,
    userName?: string,
    userId?: string,
  ): Promise<Quote> {
    // 1. Crear quote
    const quote = await this.quotesService.create(
      createQuoteDto,
      tenantId,
      tenantName,
      userEmail,
      userName,
    );

    // 2. Notificar a Slack (no-blocking)
    this.notifyQuoteCreatedToSlack(quote).catch((error) => {
      this.logger.error(
        `Error notifying Slack for quote ${quote.requestId}:`,
        error,
      );
    });

    // 3. Registrar en History (no-blocking)
    this.recordQuoteCreationInHistory(
      quote,
      userId || userEmail,
      tenantName,
    ).catch((error) => {
      this.logger.error(
        `Error recording quote creation in history ${quote.requestId}:`,
        error,
      );
    });

    return quote;
  }

  /**
   * Notificar creación de quote a Slack con todos los detalles
   * Usa actionType 'New' por defecto (para creación)
   */
  private async notifyQuoteCreatedToSlack(quote: Quote): Promise<void> {
    const message = CreateQuoteMessageToSlack(quote, 'New');
    await this.slackService.sendQuoteMessage(message);
  }

  /**
   * Cancelar quote con coordinación
   */
  async cancelQuoteWithCoordination(
    id: string,
    tenantName: string,
    userEmail: string,
  ): Promise<void> {
    // Soft delete
    await this.quotesService.delete(id, tenantName, userEmail);

    // Registrar en History (no-blocking)
    this.recordQuoteCancellationInHistory(id, userEmail).catch((error) => {
      this.logger.error(
        `Error recording quote cancellation in history ${id}:`,
        error,
      );
    });
  }

  /**
   * Registrar creación de quote en History
   */
  private async recordQuoteCreationInHistory(
    quote: Quote,
    userId: string,
    tenantName: string,
  ): Promise<void> {
    try {
      // Obtener la conexión del tenant
      const connection =
        await this.tenantConnectionService.getTenantConnection(tenantName);
      const HistoryModel = connection.model('History', HistorySchema);

      const historyData = {
        actionType: 'create',
        userId: userId,
        itemType: 'quotes',
        changes: {
          oldData: null,
          newData: {
            requestId: quote.requestId,
            tenantName: quote.tenantName,
            userEmail: quote.userEmail,
            userName: quote.userName,
            productCount: quote.products.length,
            totalQuantity: quote.products.reduce(
              (sum, p) => sum + p.quantity,
              0,
            ),
            products: quote.products.map((p) => ({
              category: p.category,
              quantity: p.quantity,
              os: p.os,
              country: p.country,
            })),
          },
        },
      };

      // Usar el modelo del tenant en lugar del servicio global
      await HistoryModel.create(historyData);
    } catch (error) {
      this.logger.error('Failed to record quote creation in history:', error);
      // No lanzar error, solo loguear
    }
  }

  /**
   * Registrar cancelación de quote en History
   */
  private async recordQuoteCancellationInHistory(
    quoteId: string,
    userEmail: string,
  ): Promise<void> {
    try {
      await this.historyService.create({
        actionType: 'cancel',
        userId: userEmail,
        itemType: 'quotes' as any, // quotes no está en el enum, pero lo permitimos
        changes: {
          oldData: {
            quoteId,
          },
          newData: null,
        },
      });
    } catch (error) {
      this.logger.error(
        'Failed to record quote cancellation in history:',
        error,
      );
      // No lanzar error, solo loguear
    }
  }
}
