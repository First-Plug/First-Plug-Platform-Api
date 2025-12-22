import { Types } from 'mongoose';
import { ServiceData } from './service.interface';

/**
 * Base interface para todos los productos
 */
export interface BaseProductItem {
  quantity: number; // ✅ OBLIGATORIO (entero positivo)
  country: string; // ✅ OBLIGATORIO (ISO code)
  city?: string;
  deliveryDate?: string; // ISO 8601 format
  comments?: string;
  otherSpecifications?: string;
}

/**
 * Computer Item
 */
export interface ComputerItem extends BaseProductItem {
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
 * Monitor Item
 */
export interface MonitorItem extends BaseProductItem {
  category: 'Monitor';
  brand?: string[];
  model?: string[];
  screenSize?: string[];
  screenTechnology?: string;
}

/**
 * Audio Item
 */
export interface AudioItem extends BaseProductItem {
  category: 'Audio';
  brand?: string[];
  model?: string[];
}

/**
 * Peripherals Item
 */
export interface PeripheralsItem extends BaseProductItem {
  category: 'Peripherals';
  brand?: string[];
  model?: string[];
}

/**
 * Merchandising Item
 */
export interface MerchandisingItem extends BaseProductItem {
  category: 'Merchandising';
  description?: string;
  additionalRequirements?: string;
}

/**
 * Phone Item
 */
export interface PhoneItem extends BaseProductItem {
  category: 'Phone';
  brand?: string[];
  model?: string[];
}

/**
 * Furniture Item
 */
export interface FurnitureItem extends BaseProductItem {
  category: 'Furniture';
  furnitureType?: string;
}

/**
 * Tablet Item
 */
export interface TabletItem extends BaseProductItem {
  category: 'Tablet';
  brand?: string[];
  model?: string[];
  screenSize?: string[];
}

/**
 * Other Item
 */
export interface OtherItem extends BaseProductItem {
  category: 'Other';
  brand?: string[];
  model?: string[];
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
  requestType: 'Comprar productos' | 'Solicitar servicio' | 'Mixto'; // Flexible
  status: 'Requested'; // Estado de la cotización (auto-seteado en creación)
  products: any[]; // Array de productos (múltiples categorías)
  services: ServiceData[]; // Array de servicios
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Tipos para discriminated union
 * Soporta múltiples categorías de productos
 */
export type ProductData =
  | ComputerItem
  | MonitorItem
  | AudioItem
  | PeripheralsItem
  | MerchandisingItem
  | PhoneItem
  | FurnitureItem
  | TabletItem
  | OtherItem;

/**
 * Constantes para validación
 */
export const REQUEST_TYPES = ['Comprar productos'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const QUOTE_STATUSES = ['Requested'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const PRODUCT_CATEGORIES = [
  'Computer',
  'Monitor',
  'Audio',
  'Peripherals',
  'Merchandising',
  'Phone',
  'Furniture',
  'Tablet',
  'Other',
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const OS_OPTIONS = ['macOS', 'Windows', 'Linux'] as const;
export type OSOption = (typeof OS_OPTIONS)[number];
