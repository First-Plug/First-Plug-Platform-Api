/**
 * DTO para mostrar quotes en tabla
 * Datos simplificados para el frontend
 */
export class QuoteTableDto {
  _id: string;
  requestId: string;
  userName?: string;
  userEmail: string;
  productCount: number; // Cantidad de productos en la quote
  totalQuantity: number; // Suma de quantities de todos los productos
  quoteStatus: 'Requested'; // Estado de la cotización
  isActive: boolean; // Basado en isDeleted (true = activa, false = cancelada)
  createdAt: Date;
  updatedAt: Date;
}
