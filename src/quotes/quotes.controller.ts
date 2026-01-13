import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { QuotesCoordinatorService } from './quotes-coordinator.service';
import {
  CreateQuoteDto,
  UpdateQuoteDto,
  QuoteTableWithDetailsDto,
} from './dto';
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
   * Obtener todas las quotes del usuario CON paginación y filtrado por fecha
   * Query params:
   *   - page: número de página (default: 1)
   *   - size: cantidad de registros por página (default: 10)
   *   - startDate: fecha inicio (ISO 8601)
   *   - endDate: fecha fin (ISO 8601)
   * Retorna: datos completos de cada quote incluyendo todos los productos y servicios
   *
   * NOTA: Si una quote tiene servicios, se expanden como filas adicionales
   * Ejemplo: 1 quote con 2 productos + 1 servicio = 3 filas en la tabla
   */
  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('size') size: string = '10',
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: any,
  ): Promise<{
    data: QuoteTableWithDetailsDto[];
    totalCount: number;
    totalPages: number;
  }> {
    const { tenantName, email: userEmail } = req.user;

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(size, 10) || 10;

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const result = await this.quotesCoordinator.quotesService.findAllPaginated(
      tenantName,
      userEmail,
      pageNumber,
      pageSize,
      start,
      end,
    );

    // Expandir servicios como filas adicionales
    const expandedData = result.data.flatMap((quote) =>
      this.expandQuoteWithServices(quote),
    );

    return {
      data: expandedData,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
    };
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
   * PATCH /quotes/:id/cancel
   * Cancelar una quote (cambiar status a 'Cancelled')
   * ✅ Valida formato de ID
   * Retorna la quote actualizada con status 'Cancelled'
   */
  @Patch(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<QuoteResponseDto> {
    this.validateObjectId(id);
    const { tenantName, email: userEmail } = req.user;

    // Obtener quote antes de cancelar (para history y Slack)
    const quote = await this.quotesCoordinator.quotesService.findById(
      id,
      tenantName,
      userEmail,
    );

    // Cambiar status a Cancelled y desencadenar Slack + History
    const cancelledQuote =
      await this.quotesCoordinator.cancelQuoteWithCoordination(
        id,
        tenantName,
        userEmail,
        quote,
      );

    return this.mapToResponseDto(cancelledQuote);
  }

  /**
   * Expandir quote con servicios como filas adicionales
   * Si una quote tiene servicios, crea una fila por cada servicio
   * Para quotes mixed (productos + servicios):
   *   - Primera fila: productos + todos los servicios
   *   - Filas adicionales: cada servicio individual (con productos también)
   * Ejemplo: 1 quote con 2 productos + 1 servicio = 2 filas
   */
  private expandQuoteWithServices(quote: any): QuoteTableWithDetailsDto[] {
    const baseRow = this.mapToTableWithDetailsDto(quote);

    // Si no hay servicios, retornar solo la fila base
    if (!quote.services || quote.services.length === 0) {
      return [baseRow];
    }

    // Si hay servicios, crear una fila por cada servicio
    // Pero mantener los productos en todas las filas (para quotes mixed)
    return quote.services.map((service: any, index: number) => ({
      ...baseRow,
      // Marcar como fila de servicio
      _id: `${quote._id?.toString()}-service-${index}`,
      // Mostrar solo este servicio
      services: [service],
      // ✅ MANTENER productos en filas de servicio (para quotes mixed)
      // products: baseRow.products (ya está en ...baseRow)
      // Mantener el conteo total de servicios
      serviceCount: quote.services.length,
    }));
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
      status: quote.status,
      products: quote.products || [],
      services: quote.services || [],
      isDeleted: quote.isDeleted,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };
  }

  /**
   * Mapear Quote a QuoteTableWithDetailsDto (CON TODOS LOS DETALLES)
   * Incluye todos los datos del quote, productos y servicios para que el frontend
   * NO necesite hacer un GET by ID adicional
   */
  private mapToTableWithDetailsDto(quote: any): QuoteTableWithDetailsDto {
    const totalQuantity = (quote.products || []).reduce(
      (sum: number, product: any) => sum + (product.quantity || 0),
      0,
    );

    return {
      _id: quote._id?.toString(),
      requestId: quote.requestId,
      tenantId: quote.tenantId?.toString(),
      tenantName: quote.tenantName,
      userName: quote.userName,
      userEmail: quote.userEmail,
      requestType: quote.requestType,
      status: quote.status || 'Requested', // Usar status del quote
      productCount: (quote.products || []).length,
      serviceCount: (quote.services || []).length,
      totalQuantity,
      products: quote.products || [], // ✅ Todos los datos de los productos
      services: quote.services || [], // ✅ Todos los datos de los servicios
      isActive: !quote.isDeleted,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
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
