import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';
import {
  COMMUNICATION_CHANNELS,
  PARTNER_TYPES,
  DEFAULT_COMMUNICATION_CHANNEL,
  DEFAULT_PARTNER_TYPE,
} from '../constants/warehouse.constants';

export type WarehouseDocument = Warehouse & Document;

// Subdocumento para cada warehouse individual
@Schema({ timestamps: true })
export class WarehouseItem {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  address: string;

  @Prop({ type: String, required: false })
  apartment: string;

  @Prop({ type: String, required: true })
  city: string;

  @Prop({ type: String, required: true })
  state: string;

  @Prop({ type: String, required: true })
  zipCode: string;

  @Prop({ type: String, required: false })
  email: string;

  @Prop({ type: String, required: false })
  phone: string;

  @Prop({ type: String, required: false })
  contactPerson: string;

  @Prop({ type: Boolean, default: false })
  isActive: boolean;

  @Prop({ type: String, required: false })
  additionalInfo: string;

  @Prop({
    type: String,
    enum: COMMUNICATION_CHANNELS,
    default: DEFAULT_COMMUNICATION_CHANNEL,
  })
  canal: string;

  @Prop({
    type: String,
    enum: PARTNER_TYPES,
    default: DEFAULT_PARTNER_TYPE,
  })
  partnerType: string;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Date, required: false })
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const WarehouseItemSchema = SchemaFactory.createForClass(WarehouseItem);

// Documento principal por país
@Schema({ timestamps: true })
export class Warehouse extends Document {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  country: string;

  @Prop({ type: String, required: true, unique: true })
  countryCode: string;

  @Prop({ type: [WarehouseItemSchema], default: [] })
  warehouses: WarehouseItem[];

  @Prop({ type: Boolean, default: false })
  hasActiveWarehouse: boolean; // Campo computado para queries rápidas

  createdAt: Date;
  updatedAt: Date;
}

export const WarehouseSchema =
  SchemaFactory.createForClass(Warehouse).plugin(softDeletePlugin);

// Middleware para actualizar hasActiveWarehouse automáticamente
WarehouseSchema.pre('save', function (next) {
  const warehouse = this as WarehouseDocument;
  warehouse.hasActiveWarehouse = warehouse.warehouses.some(
    (w) => w.isActive && !w.isDeleted,
  );
  next();
});

// Índices para optimizar queries
WarehouseSchema.index({ country: 1 });
WarehouseSchema.index({ countryCode: 1 });
WarehouseSchema.index({ 'warehouses.isActive': 1 });
WarehouseSchema.index({ hasActiveWarehouse: 1 });
