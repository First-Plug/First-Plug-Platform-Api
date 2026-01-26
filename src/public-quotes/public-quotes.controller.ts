import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PublicQuotesCoordinatorService } from './public-quotes-coordinator.service';
import { CreatePublicQuoteDto } from './dto/create-public-quote.dto';
import { PublicQuoteResponseDto } from './dto/public-quote-response.dto';
import { ValidationHelper } from './helpers/validation.helper';
import { RateLimitHelper } from './helpers/rate-limit.helper';

@Controller('public-quotes')
export class PublicQuotesController {
  constructor(
    private publicQuotesCoordinatorService: PublicQuotesCoordinatorService,
    private rateLimitHelper: RateLimitHelper,
  ) {}

  /**
   * POST /api/public-quotes/create
   * Crear una quote pública (sin autenticación)
   * Rate limiting: 10 requests/minuto por IP
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createPublicQuote(
    @Body() data: CreatePublicQuoteDto,
    @Req() request: Request,
  ): Promise<PublicQuoteResponseDto> {
    // Verificar rate limiting
    const clientIp = request.ip || 'unknown';
    this.rateLimitHelper.checkRateLimit(clientIp);

    // Sanitizar entrada
    const sanitizedData = ValidationHelper.sanitizeInput(data);

    // Validar con Zod
    const validatedData =
      ValidationHelper.validateCreatePublicQuote(sanitizedData);

    // Orquestar creación de quote
    const result =
      await this.publicQuotesCoordinatorService.createPublicQuote(
        validatedData,
      );

    return new PublicQuoteResponseDto(result.quoteNumber);
  }
}
