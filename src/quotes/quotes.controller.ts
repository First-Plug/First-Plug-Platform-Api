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
  BadRequestException,
} from '@nestjs/common';
import { QuotesCoordinatorService } from './quotes-coordinator.service';
import { CreateQuoteDto, UpdateQuoteDto, QuoteTableDto } from './dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { Types } from 'mongoose';
import { CreateQuoteSchema, UpdateQuoteSchema } from './validations';
import { ZodError } from 'zod';

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
   * ✅ Valida estructura de productos con Zod
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createQuoteDto: CreateQuoteDto,
    @Req() req: any,
  ): Promise<QuoteResponseDto> {
    try {
      // ✅ Validar con Zod
      const validated = CreateQuoteSchema.parse(createQuoteDto);

      const {
        _id: userId,
        tenantId,
        tenantName,
        email: userEmail,
        firstName,
        lastName,
      } = req.user;

      const userName = `${firstName} ${lastName}`.trim();

      const quote = await this.quotesCoordinator.createQuoteWithCoordination(
        validated,
        new Types.ObjectId(tenantId),
        tenantName,
        userEmail,
        userName,
        userId,
      );

      return this.mapToResponseDto(quote);
    } catch (error) {
      this.handleValidationError(error);
    }
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
   * ✅ Valida formato de ID
   */
  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<QuoteResponseDto> {
    this.validateObjectId(id);
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
   * ✅ Valida formato de ID y estructura de datos
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateQuoteDto: UpdateQuoteDto,
    @Req() req: any,
  ): Promise<QuoteResponseDto> {
    try {
      this.validateObjectId(id);
      // ✅ Validar con Zod
      const validated = UpdateQuoteSchema.parse(updateQuoteDto);

      const { tenantName, email: userEmail } = req.user;

      const quote = await this.quotesCoordinator.quotesService.update(
        id,
        validated,
        tenantName,
        userEmail,
      );

      return this.mapToResponseDto(quote);
    } catch (error) {
      this.handleValidationError(error);
    }
  }

  /**
   * DELETE /quotes/:id
   * Cancelar una quote (soft delete)
   * ✅ Valida formato de ID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Req() req: any): Promise<void> {
    this.validateObjectId(id);
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

  /**
   * Validar que el ID sea un ObjectId válido
   * ✅ Lanza BadRequestException si es inválido
   */
  private validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ID format: ${id}`);
    }
  }

  /**
   * Manejar errores de validación Zod
   * ✅ Convierte ZodError a respuesta HTTP clara
   */
  private handleValidationError(error: any): never {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    throw error;
  }
}
