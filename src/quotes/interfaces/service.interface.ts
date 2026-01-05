import { Types } from 'mongoose';

/**
 * Snapshot del producto para auditoría
 */
export interface ProductSnapshot {
  category?: string; // Categoría del producto (Computer, Monitor, Audio, etc.)
  name?: string; // Nombre del producto
  brand?: string; // Marca del producto
  model?: string; // Modelo del producto
  serialNumber?: string;
  location?: string; // Employee, FP warehouse, Our office
  assignedTo?: string; // member name, office name, or warehouse name
  assignedEmail?: string; // Email del miembro asignado (si aplica)
  countryCode?: string; // ISO country code (AR, BR, US, etc.)
}

/**
 * Base interface para todos los servicios
 */
export interface BaseServiceItem {
  productId?: Types.ObjectId; // ID del producto en warehouse
  productSnapshot?: ProductSnapshot;
  issues: string[]; // Array de issues seleccionados (min 1)
  description: string; // Requerido
  issueStartDate?: string; // YYYY-MM-DD format (opcional)
  impactLevel: 'low' | 'medium' | 'high'; // Requerido
}

/**
 * IT Support Service
 */
export interface ITSupportService extends BaseServiceItem {
  serviceCategory: 'IT Support';
}

/**
 * Enrollment Service
 * Permite enrollar múltiples dispositivos (Mac, Windows, etc.)
 */
export interface EnrollmentService {
  serviceCategory: 'Enrollment';
  enrolledDevices: ProductSnapshot[]; // Array de dispositivos a enrollar con snapshots
  additionalDetails?: string; // Detalles adicionales (opcional)
}

/**
 * Ubicación de miembro (Employee)
 */
export interface MemberLocation {
  memberId?: string; // ID del miembro
  assignedMember?: string; // Nombre del miembro (consistente con Product schema)
  assignedEmail?: string; // Email del miembro (consistente con Product schema)
  countryCode?: string; // ISO country code del miembro
}

/**
 * Ubicación de oficina
 */
export interface OfficeLocation {
  officeId?: string; // ID de la oficina
  officeName?: string; // Nombre de la oficina
  countryCode?: string; // ISO country code de la oficina
}

/**
 * Ubicación de warehouse
 */
export interface WarehouseLocation {
  warehouseId?: string; // ID del warehouse
  warehouseName?: string; // Nombre del warehouse
  countryCode?: string; // ISO country code del warehouse
}

/**
 * Destino de Data Wipe
 */
export interface DataWipeDestination {
  destinationType?: 'Employee' | 'Our office' | 'FP warehouse'; // Tipo de destino
  member?: MemberLocation; // Datos del miembro si destinationType es 'Employee'
  office?: OfficeLocation; // Datos de la oficina si destinationType es 'Our office'
  warehouse?: WarehouseLocation; // Datos del warehouse si destinationType es 'FP warehouse'
}

/**
 * Asset en Data Wipe Service
 */
export interface DataWipeAsset {
  productId?: string; // ID del producto
  productSnapshot?: ProductSnapshot; // Snapshot del producto
  desirableDate?: string; // YYYY-MM-DD format - Fecha deseada para el wipe (opcional)
  currentLocation?: 'Employee' | 'Our office' | 'FP warehouse'; // Ubicación actual del producto
  currentMember?: MemberLocation; // Datos del miembro si currentLocation es 'Employee'
  currentOffice?: OfficeLocation; // Datos de la oficina si currentLocation es 'Our office'
  currentWarehouse?: WarehouseLocation; // Datos del warehouse si currentLocation es 'FP warehouse'
  destination?: DataWipeDestination; // Destino después del wipe (opcional)
}

/**
 * Data Wipe Service
 * Permite solicitar data wipe para múltiples assets (Computer o Other)
 */
export interface DataWipeService {
  serviceCategory: 'Data Wipe';
  assets: DataWipeAsset[]; // Array de assets a hacer wipe
  additionalDetails?: string; // Detalles adicionales (opcional)
}

/**
 * Producto en Destruction and Recycling Service
 */
export interface DestructionProduct {
  productId?: string; // ID del producto
  productSnapshot?: ProductSnapshot; // Snapshot del producto
}

/**
 * Destruction and Recycling Service
 * Permite solicitar destrucción y reciclaje de múltiples productos
 */
export interface DestructionAndRecyclingService {
  serviceCategory: 'Destruction and Recycling';
  products: DestructionProduct[]; // Array de productos a destruir con snapshots
  requiresCertificate?: boolean; // ¿Se requiere certificado de destrucción?
  comments?: string; // Comentarios adicionales (opcional)
}

/**
 * Detalles de Buyback para un producto
 */
export interface BuybackProductDetails {
  generalFunctionality?: string; // Descripción del funcionamiento general (opcional)
  batteryCycles?: number; // Ciclos de batería (opcional)
  aestheticDetails?: string; // Detalles estéticos (opcional, text area)
  hasCharger?: boolean; // ¿Tiene cargador? (opcional)
  chargerWorks?: boolean; // ¿Funciona el cargador? (opcional)
  additionalComments?: string; // Otros comentarios (opcional)
}

/**
 * Producto en Buyback Service
 */
export interface BuybackProduct {
  productId?: string; // ID del producto
  productSnapshot?: ProductSnapshot; // Snapshot del producto
  buybackDetails?: BuybackProductDetails; // Detalles específicos del buyback
}

/**
 * Buyback Service
 * Permite solicitar cotización de compra de productos usados
 */
export interface BuybackService {
  serviceCategory: 'Buyback';
  products: BuybackProduct[]; // Array de productos con detalles de buyback
  additionalInfo?: string; // Información adicional (opcional)
}

/**
 * Producto en Donate Service
 */
export interface DonateProduct {
  productId?: string; // ID del producto
  productSnapshot?: ProductSnapshot; // Snapshot del producto
  needsDataWipe?: boolean; // ¿Necesita data wipe? (solo si category es Computer o Other)
  needsCleaning?: boolean; // ¿Necesita limpieza?
  comments?: string; // Comentarios adicionales (opcional)
}

/**
 * Donate Service
 * Permite solicitar donación de múltiples productos
 */
export interface DonateService {
  serviceCategory: 'Donate';
  products: DonateProduct[]; // Array de productos a donar con detalles
  additionalDetails?: string; // Detalles adicionales (opcional)
}

/**
 * Producto en Cleaning Service
 */
export interface CleaningProduct {
  productId?: string; // ID del producto
  productSnapshot?: ProductSnapshot; // Snapshot del producto
  desiredDate?: string; // YYYY-MM-DD format - Fecha deseada para la limpieza (opcional)
  cleaningType?: 'Superficial' | 'Deep'; // Tipo de limpieza: Superficial o Deep
  additionalComments?: string; // Comentarios adicionales (opcional)
}

/**
 * Cleaning Service
 * Permite solicitar limpieza de múltiples productos (Computer o Other)
 */
export interface CleaningService {
  serviceCategory: 'Cleaning';
  products: CleaningProduct[]; // Array de productos a limpiar con detalles
  additionalDetails?: string; // Detalles adicionales (opcional)
}

/**
 * Producto en Storage Service
 */
export interface StorageProduct {
  productId?: string; // ID del producto
  productSnapshot?: ProductSnapshot; // Snapshot del producto
  approximateSize?: string; // Tamaño aproximado (opcional) - ej: "50x30x20 cm"
  approximateWeight?: string; // Peso aproximado (opcional) - ej: "5 kg"
  approximateStorageDays?: number; // Días de guardado aproximado (opcional)
  additionalComments?: string; // Comentarios adicionales (opcional)
}

/**
 * Storage Service
 * Permite solicitar almacenamiento de múltiples productos en warehouse
 */
export interface StorageService {
  serviceCategory: 'Storage';
  products: StorageProduct[]; // Array de productos a almacenar con detalles
  additionalDetails?: string; // Detalles adicionales (opcional)
}

/**
 * Miembro origen en Offboarding Service
 */
export interface OffboardingOriginMember {
  memberId: Types.ObjectId; // ID del miembro a offboardear
  firstName: string; // Nombre del miembro
  lastName: string; // Apellido del miembro
  email: string; // Email del miembro
  countryCode: string; // ISO country code (AR, BR, US, etc.)
}

/**
 * Destino en Offboarding Service (discriminated union: Member/Office/Warehouse)
 */
export interface OffboardingDestinationBase {
  type: 'Member' | 'Office' | 'Warehouse'; // Tipo de destino
  countryCode: string; // ISO country code
}

/**
 * Destino Member en Offboarding Service
 */
export interface OffboardingDestinationMember
  extends OffboardingDestinationBase {
  type: 'Member';
  memberId: Types.ObjectId; // ID del miembro destino
  assignedMember: string; // Nombre del miembro destino
  assignedEmail: string; // Email del miembro destino
}

/**
 * Destino Office en Offboarding Service
 */
export interface OffboardingDestinationOffice
  extends OffboardingDestinationBase {
  type: 'Office';
  officeId: Types.ObjectId; // ID de la oficina destino
  officeName: string; // Nombre de la oficina destino
}

/**
 * Destino Warehouse en Offboarding Service
 */
export interface OffboardingDestinationWarehouse
  extends OffboardingDestinationBase {
  type: 'Warehouse';
  warehouseId: Types.ObjectId; // ID del warehouse destino
  warehouseName: string; // Nombre del warehouse destino
}

/**
 * Union de todos los tipos de destino en Offboarding
 */
export type OffboardingDestination =
  | OffboardingDestinationMember
  | OffboardingDestinationOffice
  | OffboardingDestinationWarehouse;

/**
 * Producto en Offboarding Service
 */
export interface OffboardingProduct {
  productId?: Types.ObjectId; // ID del producto
  productSnapshot?: ProductSnapshot; // Snapshot del producto
  destination: OffboardingDestination; // Destino del producto
}

/**
 * Offboarding Service
 * Permite offboardear múltiples productos de un miembro a diferentes destinos
 */
export interface OffboardingService {
  serviceCategory: 'Offboarding';
  originMember: OffboardingOriginMember; // Miembro a offboardear
  isSensitiveSituation: boolean; // ¿Es una situación sensible?
  employeeKnows: boolean; // ¿El empleado sabe que se va?
  products: OffboardingProduct[]; // Array de productos a offboardear (mínimo 1)
  desirablePickupDate?: string; // Fecha deseable para el pickup de todos los productos (YYYY-MM-DD)
  additionalDetails?: string; // Detalles adicionales (opcional)
}

/**
 * Tipos para discriminated union
 * Soporta múltiples categorías de servicios
 */
export type ServiceData =
  | ITSupportService
  | EnrollmentService
  | DataWipeService
  | DestructionAndRecyclingService
  | BuybackService
  | DonateService
  | CleaningService
  | StorageService
  | OffboardingService;
