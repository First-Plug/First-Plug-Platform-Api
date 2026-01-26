/**
 * Base DTO para productos públicos
 */
export class BasePublicProductDto {
  category: string;
  quantity: number;
  country: string;
  city?: string;
  deliveryDate?: string;
  comments?: string;
  otherSpecifications?: string;
}

/**
 * Computer Product DTO
 */
export class ComputerProductDto extends BasePublicProductDto {
  os?: 'macOS' | 'Windows' | 'Linux';
  brand?: string[];
  model?: string[];
  processor?: string[];
  ram?: string[];
  storage?: string[];
  screenSize?: string[];
  extendedWarranty?: boolean;
  extendedWarrantyYears?: number;
  deviceEnrollment?: boolean;
}

/**
 * Monitor Product DTO
 */
export class MonitorProductDto extends BasePublicProductDto {
  brand?: string[];
  model?: string[];
  screenSize?: string[];
  screenTechnology?: string;
}

/**
 * Audio Product DTO
 */
export class AudioProductDto extends BasePublicProductDto {
  brand?: string[];
  model?: string[];
}

/**
 * Peripherals Product DTO
 */
export class PeripheralsProductDto extends BasePublicProductDto {
  brand?: string[];
  model?: string[];
  peripheralType?: string;
}

/**
 * Phone Product DTO
 */
export class PhoneProductDto extends BasePublicProductDto {
  brand?: string[];
  model?: string[];
  os?: 'iOS' | 'Android';
  storage?: string[];
}

/**
 * Tablet Product DTO
 */
export class TabletProductDto extends BasePublicProductDto {
  brand?: string[];
  model?: string[];
  screenSize?: string[];
  os?: 'iOS' | 'Android' | 'iPadOS';
}

/**
 * Furniture Product DTO
 */
export class FurnitureProductDto extends BasePublicProductDto {
  brand?: string[];
  model?: string[];
  furnitureType?: string;
}

/**
 * Merchandising Product DTO
 */
export class MerchandisingProductDto extends BasePublicProductDto {
  brand?: string[];
  model?: string[];
  merchandiseType?: string;
}

/**
 * Other Product DTO
 */
export class OtherProductDto extends BasePublicProductDto {
  brand?: string[];
  model?: string[];
  description?: string;
}

/**
 * Union type para todos los productos
 */
export type ProductDataDto =
  | ComputerProductDto
  | MonitorProductDto
  | AudioProductDto
  | PeripheralsProductDto
  | PhoneProductDto
  | TabletProductDto
  | FurnitureProductDto
  | MerchandisingProductDto
  | OtherProductDto;

/**
 * Base DTO para servicios públicos
 */
export class BasePublicServiceDto {
  serviceCategory: string;
  country: string;
  description?: string;
  additionalDetails?: string;
}

/**
 * IT Support Service DTO - Reparación/soporte de un producto específico
 */
export class ITSupportServiceDto extends BasePublicServiceDto {
  productCategory: string; // Categoría del producto a reparar (Computer, Monitor, etc.)
  productBrand: string; // Marca del producto
  productModel: string; // Modelo del producto
  issues: string[]; // Array de issues (REQUERIDO)
  description: string; // Descripción del problema (REQUERIDO)
  issueStartDate?: string; // Cuándo empezó el problema (YYYY-MM-DD)
  impactLevel: 'low' | 'medium' | 'high'; // Nivel de impacto (REQUERIDO)
}

/**
 * Enrollment Service DTO
 */
export class EnrollmentServiceDto extends BasePublicServiceDto {
  numberOfDevices?: number;
  deviceTypes?: string[];
  duration?: string;
}

/**
 * Data Wipe Service DTO
 */
export class DataWipeServiceDto extends BasePublicServiceDto {
  numberOfDevices?: number;
  deviceTypes?: string[];
  certificateRequired?: boolean;
}

/**
 * Destruction and Recycling Service DTO
 */
export class DestructionServiceDto extends BasePublicServiceDto {
  numberOfDevices?: number;
  deviceTypes?: string[];
  certificateRequired?: boolean;
}

/**
 * Buyback Service DTO
 */
export class BuybackServiceDto extends BasePublicServiceDto {
  numberOfDevices?: number;
  deviceTypes?: string[];
  estimatedValue?: number;
}

/**
 * Donate Service DTO
 */
export class DonateServiceDto extends BasePublicServiceDto {
  numberOfDevices?: number;
  deviceTypes?: string[];
  donationOrganization?: string;
}

/**
 * Cleaning Service DTO
 */
export class CleaningServiceDto extends BasePublicServiceDto {
  numberOfDevices?: number;
  cleaningType?: 'Standard' | 'Deep' | 'Sanitization';
}

/**
 * Storage Service DTO
 */
export class StorageServiceDto extends BasePublicServiceDto {
  numberOfDevices?: number;
  duration?: string;
  storageLocation?: string;
}

/**
 * Offboarding Service DTO
 */
export class OffboardingServiceDto extends BasePublicServiceDto {
  numberOfEmployees?: number;
  duration?: string;
}

/**
 * Logistics Service DTO
 */
export class LogisticsServiceDto extends BasePublicServiceDto {
  numberOfItems?: number;
  desirablePickupDate?: string;
  destination?: string;
}

/**
 * Union type para todos los servicios
 */
export type ServiceDataDto =
  | ITSupportServiceDto
  | EnrollmentServiceDto
  | DataWipeServiceDto
  | DestructionServiceDto
  | BuybackServiceDto
  | DonateServiceDto
  | CleaningServiceDto
  | StorageServiceDto
  | OffboardingServiceDto
  | LogisticsServiceDto;

export class CreatePublicQuoteDto {
  // Datos del cliente
  email: string;
  fullName: string;
  companyName: string;
  country: string;
  phone?: string;

  // Solicitud
  requestType: 'product' | 'service' | 'mixed';
  products?: ProductDataDto[];
  services?: ServiceDataDto[];
}
