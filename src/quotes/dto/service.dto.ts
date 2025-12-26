import { createZodDto } from '@anatine/zod-nestjs';
import { CreateServiceSchema } from '../validations/service.zod';

/**
 * DTO para crear un nuevo Service
 * Generado automáticamente desde Zod schema
 */
export class CreateServiceDto extends createZodDto(CreateServiceSchema) {}

/**
 * DTO para respuesta de IT Support Service
 */
export class ITSupportServiceResponseDto {
  serviceCategory: 'IT Support';
  productId?: string;
  productSnapshot?: {
    category?: string;
    name?: string;
    brand?: string;
    model?: string;
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
 * DTO para respuesta de Enrollment Service
 */
export class EnrollmentServiceResponseDto {
  serviceCategory: 'Enrollment';
  productIds?: string[]; // IDs de los productos a enrollar (referencia)
  enrolledDevices: Array<{
    category?: string;
    name?: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    location?: string;
    assignedTo?: string;
    countryCode?: string;
  }>;
  additionalDetails?: string;
}

/**
 * Union de todos los Service Response DTOs
 */
export type ServiceResponseDto =
  | ITSupportServiceResponseDto
  | EnrollmentServiceResponseDto;

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
