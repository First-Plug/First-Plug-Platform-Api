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

/**
 * Subdocumento para Enrollment Service
 * Permite enrollar múltiples dispositivos (Mac, Windows, etc.)
 */
@Schema({ _id: false })
export class EnrollmentServiceSchema {
  @Prop({ type: String, enum: ['Enrollment'], required: true })
  serviceCategory: 'Enrollment';

  @Prop({ type: [Types.ObjectId] })
  productIds?: Types.ObjectId[]; // IDs de los productos a enrollar (referencia)

  @Prop({ type: [ProductSnapshotSchema], required: true })
  enrolledDevices: ProductSnapshotSchema[]; // Array de dispositivos a enrollar con snapshots

  @Prop({ type: String })
  additionalDetails?: string; // Detalles adicionales (opcional)
}

/**
 * Subdocumento para ubicación de miembro (Employee)
 */
@Schema({ _id: false })
export class MemberLocationSchema {
  @Prop({ type: Types.ObjectId })
  memberId?: Types.ObjectId; // ID del miembro

  @Prop({ type: String })
  assignedMember?: string; // Nombre del miembro (consistente con Product schema)

  @Prop({ type: String })
  assignedEmail?: string; // Email del miembro (consistente con Product schema)

  @Prop({ type: String, maxlength: 2 })
  countryCode?: string; // ISO country code del miembro
}

/**
 * Subdocumento para ubicación de oficina
 */
@Schema({ _id: false })
export class OfficeLocationSchema {
  @Prop({ type: Types.ObjectId })
  officeId?: Types.ObjectId; // ID de la oficina

  @Prop({ type: String })
  officeName?: string; // Nombre de la oficina

  @Prop({ type: String, maxlength: 2 })
  countryCode?: string; // ISO country code de la oficina
}

/**
 * Subdocumento para ubicación de warehouse
 */
@Schema({ _id: false })
export class WarehouseLocationSchema {
  @Prop({ type: Types.ObjectId })
  warehouseId?: Types.ObjectId; // ID del warehouse

  @Prop({ type: String })
  warehouseName?: string; // Nombre del warehouse

  @Prop({ type: String, maxlength: 2 })
  countryCode?: string; // ISO country code del warehouse
}

/**
 * Subdocumento para destino de Data Wipe
 * Puede ser un miembro, oficina o warehouse
 */
@Schema({ _id: false })
export class DataWipeDestinationSchema {
  @Prop({ type: String, enum: ['Employee', 'Our office', 'FP warehouse'] })
  destinationType?: string; // Tipo de destino

  @Prop({ type: MemberLocationSchema })
  member?: MemberLocationSchema; // Datos del miembro si destinationType es 'Employee'

  @Prop({ type: OfficeLocationSchema })
  office?: OfficeLocationSchema; // Datos de la oficina si destinationType es 'Our office'

  @Prop({ type: WarehouseLocationSchema })
  warehouse?: WarehouseLocationSchema; // Datos del warehouse si destinationType es 'FP warehouse'
}

/**
 * Subdocumento para un asset en Data Wipe Service
 */
@Schema({ _id: false })
export class DataWipeAssetSchema {
  @Prop({ type: Types.ObjectId })
  productId?: Types.ObjectId; // ID del producto

  @Prop({ type: ProductSnapshotSchema })
  productSnapshot?: ProductSnapshotSchema; // Snapshot del producto

  @Prop({ type: String })
  desirableDate?: string; // YYYY-MM-DD format - Fecha deseada para el wipe (opcional)

  @Prop({ type: String, enum: ['Employee', 'Our office', 'FP warehouse'] })
  currentLocation?: string; // Ubicación actual del producto

  @Prop({ type: MemberLocationSchema })
  currentMember?: MemberLocationSchema; // Datos del miembro si currentLocation es 'Employee'

  @Prop({ type: OfficeLocationSchema })
  currentOffice?: OfficeLocationSchema; // Datos de la oficina si currentLocation es 'Our office'

  @Prop({ type: WarehouseLocationSchema })
  currentWarehouse?: WarehouseLocationSchema; // Datos del warehouse si currentLocation es 'FP warehouse'

  @Prop({ type: DataWipeDestinationSchema })
  destination?: DataWipeDestinationSchema; // Destino después del wipe (opcional)
}

/**
 * Subdocumento para Data Wipe Service
 * Permite solicitar data wipe para múltiples assets (Computer o Other)
 */
@Schema({ _id: false })
export class DataWipeServiceSchema {
  @Prop({ type: String, enum: ['Data Wipe'], required: true })
  serviceCategory: 'Data Wipe';

  @Prop({ type: [Types.ObjectId] })
  productIds?: Types.ObjectId[]; // IDs de los productos a hacer wipe (referencia)

  @Prop({ type: [DataWipeAssetSchema], required: true })
  assets: DataWipeAssetSchema[]; // Array de assets a hacer wipe

  @Prop({ type: String })
  additionalDetails?: string; // Detalles adicionales (opcional)
}
