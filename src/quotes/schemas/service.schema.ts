import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Snapshot del producto para auditoría
 * Guarda datos importantes del producto en el momento del servicio
 */
@Schema({ _id: false })
export class ProductSnapshotSchema {
  @Prop({ type: String })
  category?: string; // Categoría del producto (Computer, Monitor, Audio, etc.)

  @Prop({ type: String })
  name?: string; // Nombre del producto

  @Prop({ type: String })
  brand?: string; // Marca del producto

  @Prop({ type: String })
  model?: string; // Modelo del producto

  @Prop({ type: String })
  serialNumber?: string;

  @Prop({ type: String })
  location?: string; // Employee, FP warehouse, Our office

  @Prop({ type: String })
  assignedTo?: string; // member name, office name, or warehouse name

  @Prop({ type: String, maxlength: 2 })
  countryCode?: string; // ISO country code (AR, BR, US, etc.)
}

/**
 * Base Schema para todos los servicios
 */
@Schema({ _id: false, discriminatorKey: 'serviceCategory' })
export class BaseServiceSchema {
  @Prop({ type: Types.ObjectId })
  productId?: Types.ObjectId; // ID del producto en warehouse

  @Prop({ type: ProductSnapshotSchema })
  productSnapshot?: ProductSnapshotSchema;

  @Prop({ type: [String], required: true })
  issues: string[]; // Array de issues seleccionados

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: String })
  issueStartDate?: string; // YYYY-MM-DD format

  @Prop({ type: String, enum: ['low', 'medium', 'high'], required: true })
  impactLevel: 'low' | 'medium' | 'high';
}

/**
 * Subdocumento para IT Support Service
 */
@Schema({ _id: false })
export class ITSupportServiceSchema extends BaseServiceSchema {
  @Prop({ type: String, enum: ['IT Support'], required: true })
  serviceCategory: 'IT Support';
}
