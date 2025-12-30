/**
 * DTO para mostrar quotes en tabla (versión simplificada)
 * Datos básicos para el listado
 */
export class QuoteTableDto {
  _id: string;
  requestId: string;
  userName?: string;
  userEmail: string;
  productCount: number; // Cantidad de productos en la quote
  totalQuantity: number; // Suma de quantities de todos los productos
  quoteStatus: 'Requested' | 'Cancelled'; // Estado de la cotización
  isActive: boolean; // Basado en isDeleted (true = activa, false = cancelada)
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO para mostrar quotes en tabla CON DETALLES COMPLETOS
 * Incluye todos los datos del quote, productos y servicios para el frontend
 * El frontend NO necesita hacer un GET by ID adicional
 */
export class QuoteTableWithDetailsDto {
  _id: string;
  requestId: string;
  tenantId: string;
  tenantName: string;
  userName?: string;
  userEmail: string;
  requestType: 'product' | 'service' | 'mixed';
  status: 'Requested' | 'Cancelled'; // Puede ser Requested o Cancelled
  productCount: number; // Cantidad de productos en la quote
  serviceCount?: number; // Cantidad de servicios en la quote
  totalQuantity: number; // Suma de quantities de todos los productos
  products: any[]; // Array con todos los productos y sus datos específicos
  services?: any[]; // Array con todos los servicios y sus datos específicos
  isActive: boolean; // Basado en isDeleted (true = activa, false = cancelada)
  createdAt: Date;
  updatedAt: Date;
}
