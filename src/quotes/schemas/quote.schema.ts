import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTimestampsConfig, Types } from 'mongoose';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';
import { ComputerItem } from '../interfaces/quote.interface';

export type QuoteDocument = Quote & Document & SchemaTimestampsConfig;

/**
 * Subdocumento para ComputerItem
 */
@Schema({ _id: false })
export class ComputerItemSchema {
  @Prop({ type: String, enum: ['Computer'], required: true })
  category: 'Computer';

  @Prop({ type: String, enum: ['macOS', 'Windows', 'Linux'] })
  os?: 'macOS' | 'Windows' | 'Linux';

  @Prop({ type: Number, required: true, min: 1 })
  quantity: number;

  @Prop({ type: [String] })
  brand?: string[];

  @Prop({ type: [String] })
  model?: string[];

  @Prop({ type: [String] })
  processor?: string[];

  @Prop({ type: [String] })
  ram?: string[];

  @Prop({ type: [String] })
  storage?: string[];

  @Prop({ type: [String] })
  screenSize?: string[];

  @Prop({ type: String })
  otherSpecifications?: string;

  @Prop({ type: Boolean })
  extendedWarranty?: boolean;

  @Prop({ type: Number, min: 1 })
  extendedWarrantyYears?: number;

  @Prop({ type: Boolean })
  deviceEnrollment?: boolean;

  @Prop({ type: String, required: true, maxlength: 2 })
  country: string;

  @Prop({ type: String })
  city?: string;

  @Prop({ type: Date })
  deliveryDate?: Date;

  @Prop({ type: String })
  comments?: string;
}

/**
 * Quote Schema - Documento principal
 */
@Schema({ timestamps: true })
export class Quote {
  _id?: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  requestId: string; // QR-{tenantName}-{autoIncrement}

  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  tenantName: string;

  @Prop({ type: String, required: true })
  userEmail: string;

  @Prop({ type: String })
  userName?: string;

  @Prop({ type: String, required: true, enum: ['Comprar productos'] })
  requestType: 'Comprar productos';

  @Prop({ type: [ComputerItemSchema], required: true, default: [] })
  products: ComputerItem[];

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export const QuoteSchema =
  SchemaFactory.createForClass(Quote).plugin(softDeletePlugin);

// Crear índice compuesto para tenant + user
QuoteSchema.index({ tenantId: 1, userEmail: 1 });
QuoteSchema.index({ tenantName: 1, requestId: 1 });
