import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { QuotesService } from './quotes.service';
import { SlackService } from '../slack/slack.service';
import { HistoryService } from '../history/history.service';
import { CreateQuoteDto } from './dto';
import { Quote } from './interfaces/quote.interface';

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
    this.recordQuoteCreationInHistory(quote, userEmail).catch((error) => {
      this.logger.error(
        `Error recording quote creation in history ${quote.requestId}:`,
        error,
      );
    });

    return quote;
  }

  /**
   * Notificar creación de quote a Slack
   */
  private async notifyQuoteCreatedToSlack(quote: Quote): Promise<void> {
    const productSummary = quote.products
      .map((p) => `${p.quantity}x ${p.category}`)
      .join(', ');

    const message = {
      channel: '#quotes',
      text: `📋 Nueva Quote Creada`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*📋 Nueva Quote Creada*\n*ID:* ${quote.requestId}\n*Usuario:* ${quote.userName || quote.userEmail}\n*Productos:* ${productSummary}`,
          },
        },
      ],
    };

    await this.slackService.sendMessage(message);
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
    userEmail: string,
  ): Promise<void> {
    try {
      await this.historyService.create({
        actionType: 'create',
        userId: userEmail,
        itemType: 'quotes' as any, // quotes no está en el enum, pero lo permitimos
        changes: {
          oldData: null,
          newData: {
            requestId: quote.requestId,
            tenantName: quote.tenantName,
            productCount: quote.products.length,
            totalQuantity: quote.products.reduce(
              (sum, p) => sum + p.quantity,
              0,
            ),
          },
        },
      });
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
