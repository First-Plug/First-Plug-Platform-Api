/**
 * Base interface para todos los productos públicos
 * Similar a BaseProductItem pero sin snapshot
 */
export interface IBasePublicProduct {
  category: string;
  quantity: number; // ✅ OBLIGATORIO
  country: string; // ✅ OBLIGATORIO (ISO code)
  city?: string;
  deliveryDate?: string; // ISO 8601 format
  comments?: string;
  otherSpecifications?: string;
}

/**
 * Computer Product - Datos que el usuario público completa
 */
export interface IPublicComputerProduct extends IBasePublicProduct {
  category: 'Computer';
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
 * Monitor Product
 */
export interface IPublicMonitorProduct extends IBasePublicProduct {
  category: 'Monitor';
  brand?: string[];
  model?: string[];
  screenSize?: string[];
  screenTechnology?: string;
}

/**
 * Audio Product
 */
export interface IPublicAudioProduct extends IBasePublicProduct {
  category: 'Audio';
  brand?: string[];
  model?: string[];
}

/**
 * Peripherals Product
 */
export interface IPublicPeripheralsProduct extends IBasePublicProduct {
  category: 'Peripherals';
  brand?: string[];
  model?: string[];
  peripheralType?: string;
}

/**
 * Phone Product
 */
export interface IPublicPhoneProduct extends IBasePublicProduct {
  category: 'Phone';
  brand?: string[];
  model?: string[];
  os?: 'iOS' | 'Android';
  storage?: string[];
}

/**
 * Tablet Product
 */
export interface IPublicTabletProduct extends IBasePublicProduct {
  category: 'Tablet';
  brand?: string[];
  model?: string[];
  screenSize?: string[];
  os?: 'iOS' | 'Android' | 'iPadOS';
}

/**
 * Furniture Product
 */
export interface IPublicFurnitureProduct extends IBasePublicProduct {
  category: 'Furniture';
  brand?: string[];
  model?: string[];
  furnitureType?: string;
}

/**
 * Merchandising Product
 */
export interface IPublicMerchandisingProduct extends IBasePublicProduct {
  category: 'Merchandising';
  brand?: string[];
  model?: string[];
  merchandiseType?: string;
}

/**
 * Other Product
 */
export interface IPublicOtherProduct extends IBasePublicProduct {
  category: 'Other';
  brand?: string[];
  model?: string[];
  description?: string;
}

/**
 * Union type para todos los productos públicos
 */
export type IPublicProductData =
  | IPublicComputerProduct
  | IPublicMonitorProduct
  | IPublicAudioProduct
  | IPublicPeripheralsProduct
  | IPublicPhoneProduct
  | IPublicTabletProduct
  | IPublicFurnitureProduct
  | IPublicMerchandisingProduct
  | IPublicOtherProduct;

/**
 * Base interface para todos los servicios públicos
 */
export interface IBasePublicService {
  serviceCategory: string;
  country: string; // ✅ OBLIGATORIO
  description?: string;
  additionalDetails?: string;
}

/**
 * IT Support Service - Reparación/soporte de un producto específico
 */
export interface IPublicITSupportService extends IBasePublicService {
  serviceCategory: 'IT Support';
  productCategory?: string; // Categoría del producto a reparar (Computer, Monitor, etc.)
  productBrand?: string; // Marca del producto
  productModel?: string; // Modelo del producto
  issues: string[]; // Array de issues (REQUERIDO)
  description: string; // Descripción del problema (REQUERIDO)
  issueStartDate?: string; // Cuándo empezó el problema (YYYY-MM-DD)
  impactLevel: 'low' | 'medium' | 'high'; // Nivel de impacto (REQUERIDO)
}

/**
 * Enrollment Service
 */
export interface IPublicEnrollmentService extends IBasePublicService {
  serviceCategory: 'Enrollment';
  numberOfDevices?: number;
  deviceTypes?: string[];
  duration?: string;
}

/**
 * Data Wipe Service
 */
export interface IPublicDataWipeService extends IBasePublicService {
  serviceCategory: 'Data Wipe';
  numberOfDevices?: number;
  deviceTypes?: string[];
  certificateRequired?: boolean;
}

/**
 * Destruction and Recycling Service
 */
export interface IPublicDestructionService extends IBasePublicService {
  serviceCategory: 'Destruction and Recycling';
  numberOfDevices?: number;
  deviceTypes?: string[];
  certificateRequired?: boolean;
}

/**
 * Buyback Service
 */
export interface IPublicBuybackService extends IBasePublicService {
  serviceCategory: 'Buyback';
  numberOfDevices?: number;
  deviceTypes?: string[];
  estimatedValue?: number;
}

/**
 * Donate Service
 */
export interface IPublicDonateService extends IBasePublicService {
  serviceCategory: 'Donate';
  numberOfDevices?: number;
  deviceTypes?: string[];
  donationOrganization?: string;
}

/**
 * Cleaning Service
 */
export interface IPublicCleaningService extends IBasePublicService {
  serviceCategory: 'Cleaning';
  numberOfDevices?: number;
  cleaningType?: 'Standard' | 'Deep' | 'Sanitization';
}

/**
 * Storage Service
 */
export interface IPublicStorageService extends IBasePublicService {
  serviceCategory: 'Storage';
  numberOfDevices?: number;
  duration?: string;
  storageLocation?: string;
}

/**
 * Offboarding Service
 */
export interface IPublicOffboardingService extends IBasePublicService {
  serviceCategory: 'Offboarding';
  numberOfEmployees?: number;
  duration?: string;
}

/**
 * Logistics Service
 */
export interface IPublicLogisticsService extends IBasePublicService {
  serviceCategory: 'Logistics';
  numberOfItems?: number;
  desirablePickupDate?: string;
  destination?: string;
}

/**
 * Union type para todos los servicios públicos
 */
export type IPublicServiceData =
  | IPublicITSupportService
  | IPublicEnrollmentService
  | IPublicDataWipeService
  | IPublicDestructionService
  | IPublicBuybackService
  | IPublicDonateService
  | IPublicCleaningService
  | IPublicStorageService
  | IPublicOffboardingService
  | IPublicLogisticsService;

export interface IPublicQuote {
  // Datos del cliente
  email: string;
  fullName: string;
  companyName: string;
  country: string; // País del cliente
  phone?: string;

  // Solicitud
  requestType: 'product' | 'service' | 'mixed';
  products?: IPublicProductData[];
  services?: IPublicServiceData[];

  // Metadata
  quoteNumber?: string; // PQR-{timestamp}-{random}
  status?: 'received' | 'reviewed' | 'responded';
  notes?: string; // Notas del super admin

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPublicQuoteResponse {
  message: string;
  quoteNumber: string;
  createdAt: Date;
}
