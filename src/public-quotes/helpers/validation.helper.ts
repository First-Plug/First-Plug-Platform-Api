import { BadRequestException } from '@nestjs/common';
import { CreatePublicQuoteSchema } from '../validations/create-public-quote.zod';
import { CreatePublicQuoteInput } from '../validations/create-public-quote.zod';

export class ValidationHelper {
  /**
   * Validar datos de quote pública usando Zod
   */
  static validateCreatePublicQuote(data: any): CreatePublicQuoteInput {
    try {
      return CreatePublicQuoteSchema.parse(data);
    } catch (error: any) {
      const messages = error.errors
        .map((err: any) => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      throw new BadRequestException(`Validación fallida: ${messages}`);
    }
  }

  /**
   * Sanitizar datos de entrada
   */
  static sanitizeInput(data: any): any {
    if (typeof data === 'string') {
      return data.trim();
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeInput(item));
    }
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          sanitized[key] = this.sanitizeInput(data[key]);
        }
      }
      return sanitized;
    }
    return data;
  }
}
