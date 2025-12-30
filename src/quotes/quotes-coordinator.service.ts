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
   * Notificar cancelación de quote a Slack
   * Usa actionType 'Cancelled' para indicar que la quote fue cancelada
   */
  private async notifyQuoteCancelledToSlack(quote: Quote): Promise<void> {
    const message = CreateQuoteMessageToSlack(quote, 'Cancelled');
    await this.slackService.sendQuoteMessage(message);
  }

  /**
   * Cancelar quote con coordinación
   * 1. Cambiar status a 'Cancelled'
   * 2. Notificar a Slack (no-blocking)
   * 3. Registrar en History (no-blocking)
   */
  async cancelQuoteWithCoordination(
    id: string,
    tenantName: string,
    userEmail: string,
    quote: Quote,
  ): Promise<Quote> {
    // 1. Cambiar status a Cancelled
    const cancelledQuote = await this.quotesService.cancel(id, tenantName);

    // 2. Notificar a Slack (no-blocking)
    this.notifyQuoteCancelledToSlack(cancelledQuote).catch((error) => {
      this.logger.error(
        `Error notifying Slack for quote cancellation ${id}:`,
        error,
      );
    });

    // 3. Registrar en History (no-blocking)
    this.recordQuoteCancellationInHistory(
      quote,
      cancelledQuote,
      userEmail,
      tenantName,
    ).catch((error) => {
      this.logger.error(
        `Error recording quote cancellation in history ${id}:`,
        error,
      );
    });

    return cancelledQuote;
  }

  /**
   * Registrar creación de quote en History
   * Incluye productos y servicios
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

      const newData: any = {
        requestId: quote.requestId,
        tenantName: quote.tenantName,
        userEmail: quote.userEmail,
        userName: quote.userName,
        requestType: quote.requestType,
      };

      // Agregar productos si existen
      if (quote.products && quote.products.length > 0) {
        newData.productCount = quote.products.length;
        newData.totalQuantity = quote.products.reduce(
          (sum, p) => sum + p.quantity,
          0,
        );
        newData.products = quote.products.map((p) =>
          this.formatProductForHistory(p),
        );
      }

      // Agregar servicios si existen
      if (quote.services && quote.services.length > 0) {
        newData.serviceCount = quote.services.length;
        newData.services = quote.services.map((s) =>
          this.formatServiceForHistory(s),
        );
      }

      const historyData = {
        actionType: 'create',
        userId: userId,
        itemType: 'quotes',
        changes: {
          oldData: null,
          newData,
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
   * oldData: Quote con status 'Requested'
   * newData: Quote con status 'Cancelled'
   */
  private async recordQuoteCancellationInHistory(
    oldQuote: Quote,
    newQuote: Quote,
    userId: string,
    tenantName: string,
  ): Promise<void> {
    try {
      // Obtener la conexión del tenant
      const connection =
        await this.tenantConnectionService.getTenantConnection(tenantName);
      const HistoryModel = connection.model('History', HistorySchema);

      // Formatear oldData (quote con status 'Requested')
      const oldData: any = {
        requestId: oldQuote.requestId,
        tenantName: oldQuote.tenantName,
        userEmail: oldQuote.userEmail,
        userName: oldQuote.userName,
        requestType: oldQuote.requestType,
        status: 'Requested',
      };

      // Agregar productos si existen
      if (oldQuote.products && oldQuote.products.length > 0) {
        oldData.productCount = oldQuote.products.length;
        oldData.totalQuantity = oldQuote.products.reduce(
          (sum, p) => sum + p.quantity,
          0,
        );
        oldData.products = oldQuote.products.map((p) =>
          this.formatProductForHistory(p),
        );
      }

      // Agregar servicios si existen
      if (oldQuote.services && oldQuote.services.length > 0) {
        oldData.serviceCount = oldQuote.services.length;
        oldData.services = oldQuote.services.map((s) =>
          this.formatServiceForHistory(s),
        );
      }

      // Formatear newData (quote con status 'Cancelled')
      const newData: any = {
        requestId: newQuote.requestId,
        tenantName: newQuote.tenantName,
        userEmail: newQuote.userEmail,
        userName: newQuote.userName,
        requestType: newQuote.requestType,
        status: 'Cancelled',
      };

      // Agregar productos si existen
      if (newQuote.products && newQuote.products.length > 0) {
        newData.productCount = newQuote.products.length;
        newData.totalQuantity = newQuote.products.reduce(
          (sum, p) => sum + p.quantity,
          0,
        );
        newData.products = newQuote.products.map((p) =>
          this.formatProductForHistory(p),
        );
      }

      // Agregar servicios si existen
      if (newQuote.services && newQuote.services.length > 0) {
        newData.serviceCount = newQuote.services.length;
        newData.services = newQuote.services.map((s) =>
          this.formatServiceForHistory(s),
        );
      }

      const historyData = {
        actionType: 'cancel',
        userId: userId,
        itemType: 'quotes',
        changes: {
          oldData,
          newData,
        },
      };

      // Usar el modelo del tenant en lugar del servicio global
      await HistoryModel.create(historyData);
    } catch (error) {
      this.logger.error(
        'Failed to record quote cancellation in history:',
        error,
      );
      // No lanzar error, solo loguear
    }
  }

  /**
   * Formatear producto para historial - Incluye todos los campos específicos de cada categoría
   */
  private formatProductForHistory(product: any): Record<string, any> {
    const baseFields = {
      category: product.category,
      quantity: product.quantity,
      country: product.country,
      ...(product.city && { city: product.city }),
      ...(product.deliveryDate && { deliveryDate: product.deliveryDate }),
      ...(product.comments && { comments: product.comments }),
      ...(product.otherSpecifications && {
        otherSpecifications: product.otherSpecifications,
      }),
    };

    // Campos específicos por categoría
    switch (product.category) {
      case 'Computer':
        return {
          ...baseFields,
          ...(product.os && { os: product.os }),
          ...(product.brand && { brand: product.brand }),
          ...(product.model && { model: product.model }),
          ...(product.processor && { processor: product.processor }),
          ...(product.ram && { ram: product.ram }),
          ...(product.storage && { storage: product.storage }),
          ...(product.screenSize && { screenSize: product.screenSize }),
          ...(product.extendedWarranty !== undefined && {
            extendedWarranty: product.extendedWarranty,
          }),
          ...(product.extendedWarrantyYears && {
            extendedWarrantyYears: product.extendedWarrantyYears,
          }),
          ...(product.deviceEnrollment !== undefined && {
            deviceEnrollment: product.deviceEnrollment,
          }),
        };

      case 'Monitor':
        return {
          ...baseFields,
          ...(product.brand && { brand: product.brand }),
          ...(product.model && { model: product.model }),
          ...(product.screenSize && { screenSize: product.screenSize }),
          ...(product.screenTechnology && {
            screenTechnology: product.screenTechnology,
          }),
        };

      case 'Audio':
        return {
          ...baseFields,
          ...(product.brand && { brand: product.brand }),
          ...(product.model && { model: product.model }),
        };

      case 'Peripherals':
        return {
          ...baseFields,
          ...(product.brand && { brand: product.brand }),
          ...(product.model && { model: product.model }),
        };

      case 'Merchandising':
        return {
          ...baseFields,
          ...(product.description && { description: product.description }),
          ...(product.additionalRequirements && {
            additionalRequirements: product.additionalRequirements,
          }),
        };

      case 'Phone':
        return {
          ...baseFields,
          ...(product.brand && { brand: product.brand }),
          ...(product.model && { model: product.model }),
        };

      case 'Tablet':
        return {
          ...baseFields,
          ...(product.brand && { brand: product.brand }),
          ...(product.model && { model: product.model }),
          ...(product.screenSize && { screenSize: product.screenSize }),
        };

      case 'Furniture':
        return {
          ...baseFields,
          ...(product.furnitureType && {
            furnitureType: product.furnitureType,
          }),
        };

      case 'Other':
        return {
          ...baseFields,
          ...(product.description && { description: product.description }),
        };

      default:
        return baseFields;
    }
  }

  /**
   * Formatear servicio para historial - Incluye todos los campos del servicio
   */
  private formatServiceForHistory(service: any): Record<string, any> {
    const baseFields = {
      serviceCategory: service.serviceCategory,
      issues: service.issues,
      description: service.description,
      impactLevel: service.impactLevel,
      ...(service.issueStartDate && { issueStartDate: service.issueStartDate }),
    };

    // Agregar snapshot del producto si existe
    if (service.productSnapshot) {
      baseFields['productSnapshot'] = {
        ...(service.productSnapshot.category && {
          category: service.productSnapshot.category,
        }),
        ...(service.productSnapshot.name && {
          name: service.productSnapshot.name,
        }),
        ...(service.productSnapshot.brand && {
          brand: service.productSnapshot.brand,
        }),
        ...(service.productSnapshot.model && {
          model: service.productSnapshot.model,
        }),
        ...(service.productSnapshot.serialNumber && {
          serialNumber: service.productSnapshot.serialNumber,
        }),
        ...(service.productSnapshot.location && {
          location: service.productSnapshot.location,
        }),
        ...(service.productSnapshot.assignedTo && {
          assignedTo: service.productSnapshot.assignedTo,
        }),
        ...(service.productSnapshot.countryCode && {
          countryCode: service.productSnapshot.countryCode,
        }),
      };
    }

    // Agregar productId si existe
    if (service.productId) {
      baseFields['productId'] = service.productId;
    }

    return baseFields;
  }
}
