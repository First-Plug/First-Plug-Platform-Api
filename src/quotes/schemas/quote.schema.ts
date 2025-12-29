import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTimestampsConfig, Types } from 'mongoose';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';
import {
  ITSupportServiceSchema,
  EnrollmentServiceSchema,
  DataWipeServiceSchema,
  DestructionAndRecyclingServiceSchema,
} from './service.schema';

export type QuoteDocument = Quote & Document & SchemaTimestampsConfig;

/**
 * Base Schema para todos los productos
 */
@Schema({ _id: false, discriminatorKey: 'category' })
export class BaseProductSchema {
  @Prop({ type: Number, required: true, min: 1 })
  quantity: number;

  @Prop({ type: String, required: true, maxlength: 2 })
  country: string;

  @Prop({ type: String })
  city?: string;

  @Prop({ type: String })
  deliveryDate?: string;

  @Prop({ type: String })
  comments?: string;

  @Prop({ type: String })
  otherSpecifications?: string;
}

/**
 * Subdocumento para ComputerItem
 */
@Schema({ _id: false })
export class ComputerItemSchema extends BaseProductSchema {
  @Prop({ type: String, enum: ['Computer'], required: true })
  category: 'Computer';

  @Prop({ type: String, enum: ['macOS', 'Windows', 'Linux'] })
  os?: 'macOS' | 'Windows' | 'Linux';

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

  @Prop({ type: Boolean })
  extendedWarranty?: boolean;

  @Prop({ type: Number, min: 1 })
  extendedWarrantyYears?: number;

  @Prop({ type: Boolean })
  deviceEnrollment?: boolean;
}

/**
 * Subdocumento para MonitorItem
 */
@Schema({ _id: false })
export class MonitorItemSchema extends BaseProductSchema {
  @Prop({ type: String, enum: ['Monitor'], required: true })
  category: 'Monitor';

  @Prop({ type: [String] })
  brand?: string[];

  @Prop({ type: [String] })
  model?: string[];

  @Prop({ type: [String] })
  screenSize?: string[];

  @Prop({ type: String })
  screenTechnology?: string;
}

/**
 * Subdocumento para AudioItem
 */
@Schema({ _id: false })
export class AudioItemSchema extends BaseProductSchema {
  @Prop({ type: String, enum: ['Audio'], required: true })
  category: 'Audio';

  @Prop({ type: [String] })
  brand?: string[];

  @Prop({ type: [String] })
  model?: string[];
}

/**
 * Subdocumento para PeripheralsItem
 */
@Schema({ _id: false })
export class PeripheralsItemSchema extends BaseProductSchema {
  @Prop({ type: String, enum: ['Peripherals'], required: true })
  category: 'Peripherals';

  @Prop({ type: [String] })
  brand?: string[];

  @Prop({ type: [String] })
  model?: string[];
}

/**
 * Subdocumento para MerchandisingItem
 */
@Schema({ _id: false })
export class MerchandisingItemSchema extends BaseProductSchema {
  @Prop({ type: String, enum: ['Merchandising'], required: true })
  category: 'Merchandising';

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String })
  additionalRequirements?: string;
}

/**
 * Subdocumento para PhoneItem
 */
@Schema({ _id: false })
export class PhoneItemSchema extends BaseProductSchema {
  @Prop({ type: String, enum: ['Phone'], required: true })
  category: 'Phone';

  @Prop({ type: [String] })
  brand?: string[];

  @Prop({ type: [String] })
  model?: string[];
}

/**
 * Subdocumento para FurnitureItem
 */
@Schema({ _id: false })
export class FurnitureItemSchema extends BaseProductSchema {
  @Prop({ type: String, enum: ['Furniture'], required: true })
  category: 'Furniture';

  @Prop({ type: String })
  furnitureType?: string;
}

/**
 * Subdocumento para TabletItem
 */
@Schema({ _id: false })
export class TabletItemSchema extends BaseProductSchema {
  @Prop({ type: String, enum: ['Tablet'], required: true })
  category: 'Tablet';

  @Prop({ type: [String] })
  brand?: string[];

  @Prop({ type: [String] })
  model?: string[];

  @Prop({ type: [String] })
  screenSize?: string[];
}

/**
 * Subdocumento para OtherItem
 */
@Schema({ _id: false })
export class OtherItemSchema extends BaseProductSchema {
  @Prop({ type: String, enum: ['Other'], required: true })
  category: 'Other';

  @Prop({ type: [String] })
  brand?: string[];

  @Prop({ type: [String] })
  model?: string[];
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

  @Prop({
    type: String,
    required: true,
    enum: ['product', 'service', 'mixed'],
  })
  requestType: 'product' | 'service' | 'mixed';

  @Prop({
    type: String,
    required: true,
    enum: ['Requested', 'Cancelled'],
    default: 'Requested',
  })
  status: 'Requested' | 'Cancelled';

  @Prop({
    type: [
      {
        type: Object,
        enum: [
          ComputerItemSchema,
          MonitorItemSchema,
          AudioItemSchema,
          PeripheralsItemSchema,
          MerchandisingItemSchema,
          PhoneItemSchema,
          FurnitureItemSchema,
          TabletItemSchema,
          OtherItemSchema,
        ],
      },
    ],
    required: true,
    default: [],
  })
  products: any[];

  @Prop({
    type: [
      {
        type: Object,
        enum: [
          ITSupportServiceSchema,
          EnrollmentServiceSchema,
          DataWipeServiceSchema,
          DestructionAndRecyclingServiceSchema,
        ],
      },
    ],
    required: true,
    default: [],
  })
  services: any[];

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export const QuoteSchema =
  SchemaFactory.createForClass(Quote).plugin(softDeletePlugin);

// Crear índice compuesto para tenant + user
QuoteSchema.index({ tenantId: 1, userEmail: 1 });
QuoteSchema.index({ tenantName: 1, requestId: 1 });
