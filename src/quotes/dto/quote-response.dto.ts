import { ComputerItem } from '../interfaces/quote.interface';

/**
 * DTO para respuesta de Quote
 * Excluye campos sensibles y formatea la respuesta
 */
export class QuoteResponseDto {
  _id: string;
  requestId: string;
  tenantId: string;
  tenantName: string;
  userEmail: string;
  userName?: string;
  requestType: 'Comprar productos';
  status: 'Requested';
  products: ComputerItem[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
