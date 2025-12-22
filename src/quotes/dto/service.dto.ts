import { createZodDto } from '@anatine/zod-nestjs';
import { CreateServiceSchema } from '../validations/service.zod';

/**
 * DTO para crear un nuevo Service
 * Generado automáticamente desde Zod schema
 */
export class CreateServiceDto extends createZodDto(CreateServiceSchema) {}

/**
 * DTO para respuesta de Service
 */
export class ServiceResponseDto {
  serviceCategory: 'IT Support';
  productId?: string;
  productSnapshot?: {
    serialNumber?: string;
    location?: string;
    assignedTo?: string;
    countryCode?: string;
  };
  issues: string[];
  description: string;
  issueStartDate?: string;
  impactLevel: 'low' | 'medium' | 'high';
}

/**
 * DTO para agregar servicio a quote
 * Usado en POST /quotes/:id/services
 */
export class AddServiceToQuoteDto {
  service: {
    serviceCategory: 'IT Support';
    productId?: string;
    productSnapshot?: {
      serialNumber?: string;
      location?: string;
      assignedTo?: string;
      countryCode?: string;
    };
    issues: string[];
    description: string;
    issueStartDate?: string;
    impactLevel: 'low' | 'medium' | 'high';
  };
}
