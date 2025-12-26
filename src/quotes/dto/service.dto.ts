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
 * DTO para respuesta de Data Wipe Service
 */
export class DataWipeServiceResponseDto {
  serviceCategory: 'Data Wipe';
  productIds?: string[]; // IDs de los productos a hacer wipe (referencia)
  assets: Array<{
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
    desirableDate?: string;
    currentLocation?: 'Employee' | 'Our office' | 'FP warehouse';
    currentMember?: {
      memberId?: string;
      assignedMember?: string;
      assignedEmail?: string;
      countryCode?: string;
    };
    currentOffice?: {
      officeId?: string;
      officeName?: string;
      countryCode?: string;
    };
    currentWarehouse?: {
      warehouseId?: string;
      warehouseName?: string;
      countryCode?: string;
    };
    destination?: {
      destinationType?: 'Employee' | 'Our office' | 'FP warehouse';
      member?: {
        memberId?: string;
        assignedMember?: string;
        assignedEmail?: string;
        countryCode?: string;
      };
      office?: {
        officeId?: string;
        officeName?: string;
        countryCode?: string;
      };
      warehouse?: {
        warehouseId?: string;
        warehouseName?: string;
        countryCode?: string;
      };
    };
  }>;
  additionalDetails?: string;
}

/**
 * Union de todos los Service Response DTOs
 */
export type ServiceResponseDto =
  | ITSupportServiceResponseDto
  | EnrollmentServiceResponseDto
  | DataWipeServiceResponseDto;

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
