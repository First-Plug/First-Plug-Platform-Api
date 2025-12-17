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
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'cancelled'; // Basado en isDeleted
}

