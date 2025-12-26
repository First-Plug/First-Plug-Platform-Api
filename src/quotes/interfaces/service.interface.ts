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
  productIds?: string[]; // IDs de los productos a enrollar (referencia)
  enrolledDevices: ProductSnapshot[]; // Array de dispositivos a enrollar con snapshots
  additionalDetails?: string; // Detalles adicionales (opcional)
}

/**
 * Tipos para discriminated union
 * Soporta múltiples categorías de servicios
 */
export type ServiceData = ITSupportService | EnrollmentService;
