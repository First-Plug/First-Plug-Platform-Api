import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QuotesCoordinatorService } from './quotes-coordinator.service';
import { CreateQuoteDto, UpdateQuoteDto, QuoteTableDto } from './dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { Types } from 'mongoose';

/**
 * QuotesController
 * Endpoints REST para gestión de quotes
 */
@Controller('quotes')
@UseGuards(JwtGuard)
export class QuotesController {
  constructor(private readonly quotesCoordinator: QuotesCoordinatorService) {}

  /**
   * POST /quotes
   * Crear una nueva quote
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createQuoteDto: CreateQuoteDto,
    @Req() req: any,
  ): Promise<QuoteResponseDto> {
    const { tenantId, tenantName, email: userEmail, name: userName } = req.user;

    const quote = await this.quotesCoordinator.createQuoteWithCoordination(
      createQuoteDto,
      new Types.ObjectId(tenantId),
      tenantName,
      userEmail,
      userName,
    );

    return this.mapToResponseDto(quote);
  }

  /**
   * GET /quotes
   * Obtener todas las quotes del usuario (para tabla)
   */
  @Get()
  async findAll(@Req() req: any): Promise<QuoteTableDto[]> {
    const { tenantName, email: userEmail } = req.user;

    const quotes = await this.quotesCoordinator.quotesService.findAll(
      tenantName,
      userEmail,
    );

    return quotes.map((quote) => this.mapToTableDto(quote));
  }

  /**
   * GET /quotes/:id
   * Obtener una quote específica
   */
  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<QuoteResponseDto> {
    const { tenantName, email: userEmail } = req.user;

    const quote = await this.quotesCoordinator.quotesService.findById(
      id,
      tenantName,
      userEmail,
    );

    return this.mapToResponseDto(quote);
  }

  /**
   * PATCH /quotes/:id
   * Actualizar una quote
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateQuoteDto: UpdateQuoteDto,
    @Req() req: any,
  ): Promise<QuoteResponseDto> {
    const { tenantName, email: userEmail } = req.user;

    const quote = await this.quotesCoordinator.quotesService.update(
      id,
      updateQuoteDto,
      tenantName,
      userEmail,
    );

    return this.mapToResponseDto(quote);
  }

  /**
   * DELETE /quotes/:id
   * Cancelar una quote (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Req() req: any): Promise<void> {
    const { tenantName, email: userEmail } = req.user;

    await this.quotesCoordinator.cancelQuoteWithCoordination(
      id,
      tenantName,
      userEmail,
    );
  }

  /**
   * Mapear Quote a QuoteResponseDto
   */
  private mapToResponseDto(quote: any): QuoteResponseDto {
    return {
      _id: quote._id?.toString(),
      requestId: quote.requestId,
      tenantId: quote.tenantId?.toString(),
      tenantName: quote.tenantName,
      userEmail: quote.userEmail,
      userName: quote.userName,
      requestType: quote.requestType,
      products: quote.products,
      isDeleted: quote.isDeleted,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };
  }

  /**
   * Mapear Quote a QuoteTableDto
   */
  private mapToTableDto(quote: any): QuoteTableDto {
    const totalQuantity = quote.products.reduce(
      (sum: number, product: any) => sum + (product.quantity || 0),
      0,
    );

    return {
      _id: quote._id?.toString(),
      requestId: quote.requestId,
      userName: quote.userName,
      userEmail: quote.userEmail,
      productCount: quote.products.length,
      totalQuantity,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
      status: quote.isDeleted ? 'cancelled' : 'active',
    };
  }
}
