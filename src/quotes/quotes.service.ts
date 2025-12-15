import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TenantConnectionService } from '../infra/db/tenant-connection.service';
import { Quote, QuoteDocument, QuoteSchema } from './schemas/quote.schema';
import { CreateQuoteDto, UpdateQuoteDto } from './dto';

/**
 * QuotesService - Servicio Raíz
 * Responsabilidad: CRUD de quotes en colección tenant-específica
 * NO coordina con otros servicios (eso es responsabilidad del coordinador)
 */
@Injectable()
export class QuotesService {
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
    const requestId = await this.generateRequestId(QuoteModel, tenantName);

    const quote = new QuoteModel({
      requestId,
      tenantId,
      tenantName,
      userEmail,
      userName,
      requestType: 'Comprar productos',
      products: createQuoteDto.products,
      isDeleted: false,
    });

    return quote.save();
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
   * Usa contador en colección separada para garantizar unicidad
   */
  private async generateRequestId(
    QuoteModel: any,
    tenantName: string,
  ): Promise<string> {
    // Obtener el último número de quote
    const lastQuote = await QuoteModel.findOne()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    let nextNumber = 1;
    if (lastQuote?.requestId) {
      const match = lastQuote.requestId.match(/QR-[^-]+-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `QR-${tenantName}-${String(nextNumber).padStart(6, '0')}`;
  }
}
