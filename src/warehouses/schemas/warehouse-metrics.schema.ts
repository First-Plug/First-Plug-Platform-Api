import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type WarehouseMetricsDocument = WarehouseMetrics & Document;

// Métricas por tenant para un warehouse específico
@Schema({ _id: false })
export class TenantMetrics {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  tenantId: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, required: true })
  tenantName: string;

  @Prop({ type: String, required: false })
  companyName: string; // Nombre de la empresa (tenant.name)

  @Prop({ type: Number, default: 0 })
  totalProducts: number;

  @Prop({ type: Number, default: 0 })
  computers: number; // Renombrado de computerProducts para consistencia

  @Prop({ type: Number, default: 0 })
  otherProducts: number;

  @Prop({ type: Date, default: Date.now })
  lastUpdated: Date;
}

export const TenantMetricsSchema = SchemaFactory.createForClass(TenantMetrics);

// Documento principal de métricas por warehouse
@Schema({ timestamps: true })
export class WarehouseMetrics extends Document {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true })
  countryCode: string;

  @Prop({ type: String, required: true })
  country: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  warehouseId: MongooseSchema.Types.ObjectId; // ID del WarehouseItem

  @Prop({ type: String, required: false })
  warehouseName: string; // Cache del nombre del warehouse

  @Prop({ type: String, required: false })
  partnerType: string; // 'FirstPlug' | 'Partner'

  @Prop({ type: Boolean, default: true })
  isActive: boolean; // Cache del estado del warehouse

  // Métricas agregadas totales
  @Prop({ type: Number, default: 0 })
  totalTenants: number;

  @Prop({ type: Number, default: 0 })
  totalProducts: number;

  @Prop({ type: Number, default: 0 })
  totalComputers: number;

  @Prop({ type: Number, default: 0 })
  totalOtherProducts: number;

  // Detalle por tenant
  @Prop({ type: [TenantMetricsSchema], default: [] })
  tenantMetrics: TenantMetrics[];

  @Prop({ type: Date, default: Date.now })
  lastCalculated: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const WarehouseMetricsSchema =
  SchemaFactory.createForClass(WarehouseMetrics);

// Índices para optimizar queries
WarehouseMetricsSchema.index({ countryCode: 1 });
WarehouseMetricsSchema.index({ warehouseId: 1 }, { unique: true });
WarehouseMetricsSchema.index({ countryCode: 1, warehouseId: 1 });
WarehouseMetricsSchema.index({ lastCalculated: 1 });
WarehouseMetricsSchema.index({ 'tenantMetrics.tenantId': 1 });
