import { Injectable, Logger } from '@nestjs/common';
import { PublicQuotesService } from './public-quotes.service';
import { SlackHelper } from './helpers/slack.helper';
import { IPublicQuote } from './interfaces/public-quote.interface';

@Injectable()
export class PublicQuotesCoordinatorService {
  private readonly logger = new Logger(PublicQuotesCoordinatorService.name);

  constructor(
    private publicQuotesService: PublicQuotesService,
    private slackHelper: SlackHelper,
  ) {}

  /**
   * Orquestar el flujo completo de creación de quote público
   * 1. Generar número PQR
   * 2. Guardar en BD superior
   * 3. Enviar a Slack (no-blocking)
   */
  async createPublicQuote(data: any): Promise<any> {
    try {
      // 1. Generar número PQR único
      const quoteNumber = this.publicQuotesService.generatePublicQuoteNumber();
      this.logger.log(`Generated quote number: ${quoteNumber}`);

      // 2. Preparar datos para guardar
      const quoteData: IPublicQuote = {
        ...data,
        quoteNumber,
        status: 'received',
      };

      // 3. Guardar en BD superior
      await this.publicQuotesService.savePublicQuote(quoteData);
      this.logger.log(`Quote saved to database: ${quoteNumber}`);

      // 4. Preparar payload para Slack
      const slackPayload = this.publicQuotesService.prepareSlackPayload(
        quoteNumber,
        quoteData,
      );

      // 5. Enviar a Slack (no-blocking - no esperar respuesta)
      this.sendToSlackAsync(slackPayload).catch((error) => {
        this.logger.error(
          `Failed to send Slack notification for ${quoteNumber}:`,
          error,
        );
      });

      return {
        quoteNumber,
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Error creating public quote:', error);
      throw error;
    }
  }

  /**
   * Enviar notificación a Slack de forma asíncrona (no-blocking)
   */
  private async sendToSlackAsync(payload: any): Promise<void> {
    await this.slackHelper.sendToSlack(payload);
  }
}
