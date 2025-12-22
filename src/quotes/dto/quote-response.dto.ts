import { ComputerItem } from '../interfaces/quote.interface';
import { ServiceData } from '../interfaces/service.interface';

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
  requestType: 'product' | 'service' | 'mixed';
  status: 'Requested';
  products: ComputerItem[];
  services: ServiceData[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
