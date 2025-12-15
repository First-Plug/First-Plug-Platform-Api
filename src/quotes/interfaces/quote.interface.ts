import { Types } from 'mongoose';

/**
 * Computer Item - MVP (Único tipo de producto en primer release)
 * Contiene todos los datos de un producto Computer incluyendo delivery
 */
export interface ComputerItem {
  category: 'Computer';

  // STEP 2a: OS Selection
  os?: 'macOS' | 'Windows' | 'Linux';

  // STEP 2b: Datos específicos
  quantity: number; // ✅ OBLIGATORIO (entero positivo)

  // Arrays de strings (usuario puede seleccionar múltiples)
  brand?: string[];
  model?: string[];
  processor?: string[];
  ram?: string[];
  storage?: string[];
  screenSize?: string[];

  otherSpecifications?: string;

  // Checkboxes
  extendedWarranty?: boolean;
  extendedWarrantyYears?: number; // ✅ OBLIGATORIO si extendedWarranty === true
  deviceEnrollment?: boolean;

  // STEP 3: Datos de entrega (por producto)
  country: string; // ✅ OBLIGATORIO (ISO code)
  city?: string;
  deliveryDate?: string; // ISO 8601 format
  comments?: string;
}

/**
 * Quote - Documento MongoDB
 * Contiene múltiples productos y metadatos de la cotización
 */
export interface Quote {
  _id?: Types.ObjectId;
  requestId: string; // QR-{tenantName}-{autoIncrement}
  tenantId: Types.ObjectId;
  tenantName: string; // Necesario para requestId único
  userEmail: string; // Del token
  userName?: string; // Del token
  requestType: 'Comprar productos'; // Fijo en MVP
  products: ComputerItem[]; // Array de productos
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Tipos para discriminated union (futuro)
 * En MVP solo Computer, pero preparado para futuro
 */
export type ProductData = ComputerItem;
// | MonitorItem
// | AudioItem
// | PeripheralsItem
// | MerchandisingItem
// | OtherItem;

/**
 * Constantes para validación
 */
export const REQUEST_TYPES = ['Comprar productos'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const PRODUCT_CATEGORIES = ['Computer'] as const; // MVP
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const OS_OPTIONS = ['macOS', 'Windows', 'Linux'] as const;
export type OSOption = (typeof OS_OPTIONS)[number];
