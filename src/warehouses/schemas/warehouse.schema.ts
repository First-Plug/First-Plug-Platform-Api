import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';

export type WarehouseDocument = Warehouse & Document;

// Subdocumento para cada warehouse individual
@Schema({ timestamps: true })
export class WarehouseItem {
  _id: Types.ObjectId;

  @Prop({ type: String, required: false })
  name: string;

  @Prop({ type: String, required: false })
  address: string;

  @Prop({ type: String, required: false })
  apartment: string;

  @Prop({ type: String, required: false })
  city: string;

  @Prop({ type: String, required: false })
  state: string;

  @Prop({ type: String, required: false })
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
    enum: ['partner', 'own', 'temporary', 'default'],
    default: 'default',
  })
  partnerType: string;

  @Prop({ type: Boolean, default: false })
  isRealPartner: boolean; // false para datos placeholder

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
