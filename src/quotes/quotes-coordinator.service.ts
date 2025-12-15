import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { QuotesService } from './quotes.service';
import { SlackService } from '../slack/slack.service';
import { HistoryService } from '../history/history.service';
import { CreateQuoteDto } from './dto';
import { Quote } from './interfaces/quote.interface';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { HistorySchema } from 'src/history/schemas/history.schema';

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
   */
  private async notifyQuoteCreatedToSlack(quote: Quote): Promise<void> {
    // Construir bloques de detalles para cada producto
    const productBlocks = quote.products.flatMap((product, index) => {
      const specs: string[] = [];

      // Especificaciones del producto
      if (product.os) specs.push(`*SO:* ${product.os}`);
      if (product.brand && product.brand.length > 0)
        specs.push(`*Marcas:* ${product.brand.join(', ')}`);
      if (product.model && product.model.length > 0)
        specs.push(`*Modelos:* ${product.model.join(', ')}`);
      if (product.processor && product.processor.length > 0)
        specs.push(`*Procesadores:* ${product.processor.join(', ')}`);
      if (product.ram && product.ram.length > 0)
        specs.push(`*RAM:* ${product.ram.join(', ')}`);
      if (product.storage && product.storage.length > 0)
        specs.push(`*Almacenamiento:* ${product.storage.join(', ')}`);
      if (product.screenSize && product.screenSize.length > 0)
        specs.push(`*Tamaño Pantalla:* ${product.screenSize.join(', ')}`);
      if (product.otherSpecifications)
        specs.push(`*Otras Especificaciones:* ${product.otherSpecifications}`);

      // Información de entrega
      const deliveryInfo: string[] = [];
      if (product.country) deliveryInfo.push(`*País:* ${product.country}`);
      if (product.city) deliveryInfo.push(`*Ciudad:* ${product.city}`);
      if (product.deliveryDate)
        deliveryInfo.push(`*Fecha Entrega:* ${product.deliveryDate}`);

      // Información adicional
      const additionalInfo: string[] = [];
      if (product.extendedWarranty)
        additionalInfo.push(
          `*Garantía Extendida:* ${product.extendedWarrantyYears} años`,
        );
      if (product.deviceEnrollment)
        additionalInfo.push(`*Device Enrollment:* Sí`);
      if (product.comments)
        additionalInfo.push(`*Comentarios:* ${product.comments}`);

      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Producto ${index + 1}: ${product.quantity}x ${product.category}*\n${specs.join('\n')}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Entrega:*\n${deliveryInfo.join('\n')}`,
          },
        },
        ...(additionalInfo.length > 0
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Información Adicional:*\n${additionalInfo.join('\n')}`,
                },
              },
            ]
          : []),
        {
          type: 'divider',
        },
      ];
    });

    const message = {
      channel: '#quotes',
      text: `📋 Nueva Quote Creada - ${quote.requestId}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📋 Nueva Quote Creada',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*ID Quote:*\n${quote.requestId}`,
            },
            {
              type: 'mrkdwn',
              text: `*Tenant:*\n${quote.tenantName}`,
            },
            {
              type: 'mrkdwn',
              text: `*Usuario:*\n${quote.userName || quote.userEmail}`,
            },
            {
              type: 'mrkdwn',
              text: `*Email:*\n${quote.userEmail}`,
            },
            {
              type: 'mrkdwn',
              text: `*Variedad de Productos:*\n${quote.products.length}`,
            },
            {
              type: 'mrkdwn',
              text: `*Cantidad Total de Unidades:*\n${quote.products.reduce((sum, p) => sum + p.quantity, 0)}`,
            },
          ],
        },
        {
          type: 'divider',
        },
        ...productBlocks.slice(0, -1), // Remover último divider
      ],
    };

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
