import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IPublicQuote } from './interfaces/public-quote.interface';
import { DatabaseHelper } from './helpers/database.helper';

@Injectable()
export class PublicQuotesService {
  private readonly logger = new Logger(PublicQuotesService.name);

  constructor(
    @InjectModel('PublicQuote', 'firstPlug')
    private publicQuoteModel: Model<any>,
    private databaseHelper: DatabaseHelper,
  ) {}

  /**
   * Generar número único de quote público
   * Formato: PQR-{timestamp}-{random}
   */
  generatePublicQuoteNumber(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PQR-${timestamp}-${random}`;
  }

  /**
   * Preparar payload para enviar a Slack
   * Formato similar a quotes privadas con bloques separados por item
   */
  prepareSlackPayload(
    quoteNumber: string,
    data: IPublicQuote,
  ): Record<string, any> {
    const {
      email,
      fullName,
      companyName,
      country,
      phone,
      requestType,
      products,
      services,
    } = data;

    // Contador global de items
    let itemCounter = 1;

    const payload: any = {
      text: `📋 Nueva Quote Pública: ${quoteNumber}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `📋 Nueva Quote Pública: ${quoteNumber}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Email:*\n${email}`,
            },
            {
              type: 'mrkdwn',
              text: `*Nombre:*\n${fullName}`,
            },
            {
              type: 'mrkdwn',
              text: `*Empresa:*\n${companyName}`,
            },
            {
              type: 'mrkdwn',
              text: `*País:*\n${country}`,
            },
            {
              type: 'mrkdwn',
              text: `*Teléfono:*\n${phone || 'No proporcionado'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Tipo:*\n${requestType}`,
            },
          ],
        },
        {
          type: 'divider',
        },
      ],
    };

    // Agregar bloques de productos
    if (products && products.length > 0) {
      products.forEach((product: any) => {
        const currentItemNumber = itemCounter++;

        // Encabezado del producto
        payload.blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Item ${currentItemNumber}: x${product.quantity} ${product.category}*`,
          },
        });

        // Detalles del producto
        const specs: string[] = [];

        if (product.country || product.city) {
          const location = [product.country, product.city]
            .filter(Boolean)
            .join(', ');
          specs.push(`*Location:* ${location}`);
        }

        if (product.deliveryDate) {
          specs.push(`*Required Delivery Date:* ${product.deliveryDate}`);
        }

        if (
          product.brand &&
          Array.isArray(product.brand) &&
          product.brand.length > 0
        ) {
          specs.push(`*Brand:* ${product.brand.join(', ')}`);
        }

        if (
          product.model &&
          Array.isArray(product.model) &&
          product.model.length > 0
        ) {
          specs.push(`*Model:* ${product.model.join(', ')}`);
        }

        // Campos específicos por categoría
        if (product.os) {
          specs.push(`*Operating System:* ${product.os}`);
        }

        if (
          product.processor &&
          Array.isArray(product.processor) &&
          product.processor.length > 0
        ) {
          specs.push(`*Processor:* ${product.processor.join(', ')}`);
        }

        if (
          product.ram &&
          Array.isArray(product.ram) &&
          product.ram.length > 0
        ) {
          specs.push(`*RAM:* ${product.ram.join(', ')}`);
        }

        if (
          product.storage &&
          Array.isArray(product.storage) &&
          product.storage.length > 0
        ) {
          specs.push(`*Storage:* ${product.storage.join(', ')}`);
        }

        if (
          product.screenSize &&
          Array.isArray(product.screenSize) &&
          product.screenSize.length > 0
        ) {
          specs.push(`*Screen Size:* ${product.screenSize.join(', ')}`);
        }

        if (product.screenTechnology) {
          specs.push(`*Screen Technology:* ${product.screenTechnology}`);
        }

        if (product.peripheralType) {
          specs.push(`*Peripheral Type:* ${product.peripheralType}`);
        }

        if (product.furnitureType) {
          specs.push(`*Furniture Type:* ${product.furnitureType}`);
        }

        if (product.merchandiseType) {
          specs.push(`*Merchandise Type:* ${product.merchandiseType}`);
        }

        if (product.extendedWarranty !== undefined) {
          specs.push(
            `*Extended Warranty:* ${product.extendedWarranty ? 'Yes' : 'No'}`,
          );
        }

        if (product.extendedWarrantyYears) {
          specs.push(`*Warranty Years:* ${product.extendedWarrantyYears}`);
        }

        if (product.deviceEnrollment !== undefined) {
          specs.push(
            `*Device Enrollment:* ${product.deviceEnrollment ? 'Yes' : 'No'}`,
          );
        }

        if (product.otherSpecifications) {
          specs.push(`*Specifications:* ${product.otherSpecifications}`);
        }

        if (product.comments) {
          specs.push(`*Comments:* ${product.comments}`);
        }

        if (specs.length > 0) {
          payload.blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: specs.join('\n'),
            },
          });
        }
      });
    }

    // Agregar bloques de servicios
    if (services && services.length > 0) {
      services.forEach((service: any) => {
        const currentItemNumber = itemCounter++;

        // Encabezado del servicio
        payload.blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Item ${currentItemNumber}: ${service.serviceCategory}*`,
          },
        });

        // Detalles del servicio
        const specs: string[] = [];

        if (service.country) {
          specs.push(`*Country:* ${service.country}`);
        }

        // IT Support specific fields
        if (service.productCategory) {
          specs.push(`*Product Category:* ${service.productCategory}`);
        }

        if (service.productBrand) {
          specs.push(`*Product Brand:* ${service.productBrand}`);
        }

        if (service.productModel) {
          specs.push(`*Product Model:* ${service.productModel}`);
        }

        if (
          service.issues &&
          Array.isArray(service.issues) &&
          service.issues.length > 0
        ) {
          specs.push(`*Issues:* ${service.issues.join(', ')}`);
        }

        if (service.issueStartDate) {
          specs.push(`*Issue Start Date:* ${service.issueStartDate}`);
        }

        if (service.impactLevel) {
          specs.push(`*Impact Level:* ${service.impactLevel}`);
        }

        if (service.numberOfDevices) {
          specs.push(`*Number of Devices:* ${service.numberOfDevices}`);
        }

        if (service.numberOfEmployees) {
          specs.push(`*Number of Employees:* ${service.numberOfEmployees}`);
        }

        if (service.numberOfItems) {
          specs.push(`*Number of Items:* ${service.numberOfItems}`);
        }

        if (
          service.deviceTypes &&
          Array.isArray(service.deviceTypes) &&
          service.deviceTypes.length > 0
        ) {
          specs.push(`*Device Types:* ${service.deviceTypes.join(', ')}`);
        }

        if (service.duration) {
          specs.push(`*Duration:* ${service.duration}`);
        }

        if (service.cleaningType) {
          specs.push(`*Cleaning Type:* ${service.cleaningType}`);
        }

        if (service.storageLocation) {
          specs.push(`*Storage Location:* ${service.storageLocation}`);
        }

        if (service.donationOrganization) {
          specs.push(
            `*Donation Organization:* ${service.donationOrganization}`,
          );
        }

        if (service.certificateRequired !== undefined) {
          specs.push(
            `*Certificate Required:* ${service.certificateRequired ? 'Yes' : 'No'}`,
          );
        }

        if (service.estimatedValue) {
          specs.push(`*Estimated Value:* $${service.estimatedValue}`);
        }

        if (service.desirablePickupDate) {
          specs.push(`*Desirable Pickup Date:* ${service.desirablePickupDate}`);
        }

        if (service.description) {
          specs.push(`*Description:* ${service.description}`);
        }

        if (service.additionalDetails) {
          specs.push(`*Additional Details:* ${service.additionalDetails}`);
        }

        if (specs.length > 0) {
          payload.blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: specs.join('\n'),
            },
          });
        }
      });
    }

    // Agregar divider y timestamp
    payload.blocks.push({
      type: 'divider',
    });

    payload.blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_Creado: ${new Date().toISOString()}_`,
        },
      ],
    } as any);

    return payload;
  }

  /**
   * Guardar quote en BD superior
   * BD: firstPlug (dev) o main (prod)
   * Colección: quotes
   */
  async savePublicQuote(data: IPublicQuote): Promise<any> {
    try {
      const dbName = this.databaseHelper.getDatabaseName();
      this.logger.log(
        `Saving public quote to ${dbName}.quotes: ${data.quoteNumber}`,
      );

      const savedQuote = await this.publicQuoteModel.create(data);
      this.logger.log(`Quote saved successfully: ${data.quoteNumber}`);
      return savedQuote;
    } catch (error) {
      this.logger.error(`Error saving public quote: ${error.message}`, error);
      throw error;
    }
  }
}
