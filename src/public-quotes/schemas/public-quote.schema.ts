import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'publicquotes', timestamps: true, strict: false })
export class PublicQuote extends Document {
  // Datos del cliente
  email: string;
  fullName: string;
  companyName: string;
  country: string;
  phone?: string;

  // Solicitud
  requestType: 'product' | 'service' | 'mixed';
  products?: any[];
  services?: any[];

  // Metadata
  quoteNumber: string; // PQR-{timestamp}-{random}
  status: 'received' | 'reviewed' | 'responded';
  notes?: string; // Notas del super admin

  // Timestamps (automáticos)
  createdAt: Date;
  updatedAt: Date;
}

export const PublicQuoteSchema = SchemaFactory.createForClass(PublicQuote);

// Permitir campos adicionales (strict: false)
PublicQuoteSchema.set('strict', false);

// Crear índices
PublicQuoteSchema.index({ quoteNumber: 1 }, { unique: true });
PublicQuoteSchema.index({ email: 1 });
PublicQuoteSchema.index({ country: 1 });
PublicQuoteSchema.index({ requestType: 1 });
PublicQuoteSchema.index({ status: 1 });
PublicQuoteSchema.index({ createdAt: -1 });
