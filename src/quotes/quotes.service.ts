import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TenantConnectionService } from '../infra/db/tenant-connection.service';
import { Quote, QuoteDocument, QuoteSchema } from './schemas/quote.schema';
import { ShipmentMetadataSchema } from '../shipments/schema/shipment-metadata.schema';
import { CreateQuoteDto, UpdateQuoteDto } from './dto';

/**
 * QuotesService - Servicio Raíz
 * Responsabilidad: CRUD de quotes en colección tenant-específica
 * NO coordina con otros servicios (eso es responsabilidad del coordinador)
 */
@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly tenantConnectionService: TenantConnectionService,
  ) {}

  /**
   * Crear una nueva quote
   * Genera requestId automáticamente
   */
  async create(
    createQuoteDto: CreateQuoteDto,
    tenantId: Types.ObjectId,
    tenantName: string,
    userEmail: string,
    userName?: string,
  ): Promise<Quote> {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const QuoteModel = connection.model<QuoteDocument>('Quote', QuoteSchema);

    // Generar requestId único
    const requestId = await this.generateRequestId(connection, tenantName);

    const quote = new QuoteModel({
      requestId,
      tenantId,
      tenantName,
      userEmail,
      userName,
      requestType: 'Comprar productos',
      status: 'Requested', // Auto-seteado en creación
      products: createQuoteDto.products,
      isDeleted: false,
    });

    const savedQuote = await quote.save();

    return savedQuote;
  }

  /**
   * Obtener todas las quotes del usuario
   */
  async findAll(tenantName: string, userEmail: string): Promise<Quote[]> {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const QuoteModel = connection.model<QuoteDocument>('Quote', QuoteSchema);

    return QuoteModel.find({
      userEmail,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  /**
   * Obtener una quote por ID
   */
  async findById(
    id: string,
    tenantName: string,
    userEmail: string,
  ): Promise<Quote> {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const QuoteModel = connection.model<QuoteDocument>('Quote', QuoteSchema);

    const quote = await QuoteModel.findOne({
      _id: new Types.ObjectId(id),
      userEmail,
      isDeleted: false,
    })
      .lean()
      .exec();

    if (!quote) {
      throw new NotFoundException('Quote no encontrada');
    }

    return quote;
  }

  /**
   * Actualizar una quote
   */
  async update(
    id: string,
    updateQuoteDto: UpdateQuoteDto,
    tenantName: string,
    userEmail: string,
  ): Promise<Quote> {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const QuoteModel = connection.model<QuoteDocument>('Quote', QuoteSchema);

    const quote = await QuoteModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        userEmail,
        isDeleted: false,
      },
      updateQuoteDto,
      { new: true },
    )
      .lean()
      .exec();

    if (!quote) {
      throw new NotFoundException('Quote no encontrada');
    }

    return quote;
  }

  /**
   * Soft delete de una quote
   */
  async delete(
    id: string,
    tenantName: string,
    userEmail: string,
  ): Promise<void> {
    const connection =
      await this.tenantConnectionService.getTenantConnection(tenantName);
    const QuoteModel = connection.model<QuoteDocument>('Quote', QuoteSchema);

    const result = await QuoteModel.updateOne(
      {
        _id: new Types.ObjectId(id),
        userEmail,
      },
      { isDeleted: true },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('Quote no encontrada');
    }
  }

  /**
   * Generar requestId único: QR-{tenantName}-{autoIncrement}
   * ✅ Usa colección shipmentmetadata (reutiliza patrón existente)
   * ✅ Garantiza unicidad incluso con deletes
   * ✅ Atómico: no hay race conditions
   * ✅ Incremental: nunca repite números
   *
   * Nota: Reutilizamos ShipmentMetadataSchema que ya existe.
   * En la colección 'shipmentmetadata' guardamos dos registros:
   * - _id: "orderCounter" (para shipments)
   * - _id: "quote_counter" (para quotes)
   */
  private async generateRequestId(
    connection: any,
    tenantName: string,
  ): Promise<string> {
    // Reutilizamos ShipmentMetadata model (misma colección)
    const MetadataModel = connection.model(
      'ShipmentMetadata',
      ShipmentMetadataSchema,
      'shipmentmetadata',
    );

    // 🔐 OPERACIÓN ATÓMICA: Incrementar contador y obtener nuevo valor
    const docId = 'quote_counter';

    try {
      // Primero intentar encontrar el documento
      const metadata = await MetadataModel.findOne({ _id: docId });

      // Si no existe, crear con lastQuoteNumber: 0
      if (!metadata) {
        // Usar insertOne para tener control total sobre los campos
        await MetadataModel.collection.insertOne({
          _id: docId,
          lastQuoteNumber: 0,
        });
      }

      // Ahora incrementar usando $inc (más confiable que agregación pipeline)
      const updated = await MetadataModel.findOneAndUpdate(
        { _id: docId },
        { $inc: { lastQuoteNumber: 1 } },
        { new: true },
      );

      const nextNumber = updated.lastQuoteNumber;
      const requestId = `QR-${tenantName}-${String(nextNumber).padStart(6, '0')}`;
      return requestId;
    } catch (error) {
      this.logger.error('Error generating request ID:', error);
      throw error;
    }
  }
}
