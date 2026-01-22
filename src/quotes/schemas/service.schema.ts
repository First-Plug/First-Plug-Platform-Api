import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Snapshot del producto para auditoría
 * Guarda datos importantes del producto en el momento del servicio
 */
@Schema({ _id: false })
export class ProductSnapshotSchema {
  @Prop({ type: String })
  category?: string;

  @Prop({ type: String })
  name?: string;

  @Prop({ type: String })
  brand?: string;

  @Prop({ type: String })
  model?: string;

  @Prop({ type: String })
  serialNumber?: string;

  @Prop({ type: String })
  location?: string;

  @Prop({ type: String })
  assignedTo?: string;

  @Prop({ type: String })
  assignedEmail?: string;

  @Prop({ type: String, maxlength: 2 })
  countryCode?: string;
}

/**
 * Base Schema para todos los servicios
 */
@Schema({ _id: false, discriminatorKey: 'serviceCategory' })
export class BaseServiceSchema {
  @Prop({ type: Types.ObjectId })
  productId?: Types.ObjectId;

  @Prop({ type: ProductSnapshotSchema })
  productSnapshot?: ProductSnapshotSchema;

  @Prop({ type: [String], required: true })
  issues: string[];

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: String })
  issueStartDate?: string;

  @Prop({ type: String, enum: ['low', 'medium', 'high'], required: true })
  impactLevel: 'low' | 'medium' | 'high';
}

/**
 * Subdocumento para IT Support Service
 * Incluye soporte para adjuntos (imágenes) - Release 2
 */
@Schema({ _id: false })
export class ITSupportServiceSchema extends BaseServiceSchema {
  @Prop({ type: String, enum: ['IT Support'], required: true })
  serviceCategory: 'IT Support';

  @Prop({
    type: [
      {
        provider: { type: String, enum: ['cloudinary', 's3'], required: true },
        publicId: { type: String, required: true, index: true },
        secureUrl: { type: String, required: true },
        mimeType: {
          type: String,
          enum: ['image/jpeg', 'image/png', 'image/webp'],
          required: true,
        },
        bytes: { type: Number, required: true, min: 0, max: 5242880 },
        originalName: { type: String },
        resourceType: { type: String },
        createdAt: { type: Date, required: true, default: () => new Date() },
        expiresAt: { type: Date, required: true, index: true },
      },
    ],
    default: [],
  })
  attachments: Array<{
    provider: 'cloudinary' | 's3';
    publicId: string;
    secureUrl: string;
    mimeType: string;
    bytes: number;
    originalName?: string;
    resourceType?: string;
    createdAt: Date;
    expiresAt: Date;
  }> = [];
}

/**
 * Subdocumento para Enrollment Service
 * Permite enrollar múltiples dispositivos (Mac, Windows, etc.)
 */
@Schema({ _id: false })
export class EnrollmentServiceSchema {
  @Prop({ type: String, enum: ['Enrollment'], required: true })
  serviceCategory: 'Enrollment';

  @Prop({ type: [ProductSnapshotSchema], required: true })
  enrolledDevices: ProductSnapshotSchema[];

  @Prop({ type: String })
  additionalDetails?: string;
}

/**
 * Subdocumento para ubicación de miembro (Employee)
 */
@Schema({ _id: false })
export class MemberLocationSchema {
  @Prop({ type: Types.ObjectId })
  memberId?: Types.ObjectId;

  @Prop({ type: String })
  assignedMember?: string;

  @Prop({ type: String })
  assignedEmail?: string;

  @Prop({ type: String, maxlength: 2 })
  countryCode?: string;
}

/**
 * Subdocumento para ubicación de oficina
 */
@Schema({ _id: false })
export class OfficeLocationSchema {
  @Prop({ type: Types.ObjectId })
  officeId?: Types.ObjectId;

  @Prop({ type: String })
  officeName?: string;

  @Prop({ type: String, maxlength: 2 })
  countryCode?: string;
}

/**
 * Subdocumento para ubicación de warehouse
 */
@Schema({ _id: false })
export class WarehouseLocationSchema {
  @Prop({ type: Types.ObjectId })
  warehouseId?: Types.ObjectId;

  @Prop({ type: String })
  warehouseName?: string;

  @Prop({ type: String, maxlength: 2 })
  countryCode?: string;
}

/**
 * Subdocumento para destino de Data Wipe
 * Puede ser un miembro, oficina o warehouse
 */
@Schema({ _id: false })
export class DataWipeDestinationSchema {
  @Prop({ type: String, enum: ['Employee', 'Our office', 'FP warehouse'] })
  destinationType?: string;

  @Prop({ type: MemberLocationSchema })
  member?: MemberLocationSchema;

  @Prop({ type: OfficeLocationSchema })
  office?: OfficeLocationSchema;

  @Prop({ type: WarehouseLocationSchema })
  warehouse?: WarehouseLocationSchema;
}

/**
 * Subdocumento para un asset en Data Wipe Service
 */
@Schema({ _id: false })
export class DataWipeAssetSchema {
  @Prop({ type: Types.ObjectId })
  productId?: Types.ObjectId;
  @Prop({ type: ProductSnapshotSchema })
  productSnapshot?: ProductSnapshotSchema;

  @Prop({ type: String })
  desirableDate?: string;

  @Prop({ type: String, enum: ['Employee', 'Our office', 'FP warehouse'] })
  currentLocation?: string;

  @Prop({ type: MemberLocationSchema })
  currentMember?: MemberLocationSchema;

  @Prop({ type: OfficeLocationSchema })
  currentOffice?: OfficeLocationSchema;

  @Prop({ type: WarehouseLocationSchema })
  currentWarehouse?: WarehouseLocationSchema;

  @Prop({ type: DataWipeDestinationSchema })
  destination?: DataWipeDestinationSchema;
}

/**
 * Subdocumento para Data Wipe Service
 * Permite solicitar data wipe para múltiples assets (Computer o Other)
 */
@Schema({ _id: false })
export class DataWipeServiceSchema {
  @Prop({ type: String, enum: ['Data Wipe'], required: true })
  serviceCategory: 'Data Wipe';

  @Prop({ type: [DataWipeAssetSchema], required: true })
  assets: DataWipeAssetSchema[];

  @Prop({ type: String })
  additionalDetails?: string;
}

/**
 * Subdocumento para un producto en Destruction and Recycling Service
 */
@Schema({ _id: false })
export class DestructionProductSchema {
  @Prop({ type: Types.ObjectId })
  productId?: Types.ObjectId;

  @Prop({ type: ProductSnapshotSchema })
  productSnapshot?: ProductSnapshotSchema;
}

/**
 * Subdocumento para Destruction and Recycling Service
 * Permite solicitar destrucción y reciclaje de múltiples productos
 */
@Schema({ _id: false })
export class DestructionAndRecyclingServiceSchema {
  @Prop({ type: String, enum: ['Destruction and Recycling'], required: true })
  serviceCategory: 'Destruction and Recycling';

  @Prop({ type: [DestructionProductSchema], required: true })
  products: DestructionProductSchema[];

  @Prop({ type: Boolean, default: false })
  requiresCertificate?: boolean;

  @Prop({ type: String })
  comments?: string;
}

/**
 * Subdocumento para información de Buyback de un producto
 */
@Schema({ _id: false })
export class BuybackProductDetailsSchema {
  @Prop({ type: String })
  generalFunctionality?: string;

  @Prop({ type: String })
  batteryCycles?: string;

  @Prop({ type: String })
  aestheticDetails?: string;

  @Prop({ type: Boolean })
  hasCharger?: boolean;

  @Prop({ type: Boolean })
  chargerWorks?: boolean;

  @Prop({ type: String })
  additionalComments?: string;
}

/**
 * Subdocumento para un producto en Buyback Service
 */
@Schema({ _id: false })
export class BuybackProductSchema {
  @Prop({ type: Types.ObjectId })
  productId?: Types.ObjectId;

  @Prop({ type: ProductSnapshotSchema })
  productSnapshot?: ProductSnapshotSchema;
  @Prop({ type: BuybackProductDetailsSchema })
  buybackDetails?: BuybackProductDetailsSchema;
}

/**
 * Subdocumento para Buyback Service
 * Permite solicitar cotización de compra de productos usados
 */
@Schema({ _id: false })
export class BuybackServiceSchema {
  @Prop({ type: String, enum: ['Buyback'], required: true })
  serviceCategory: 'Buyback';

  @Prop({ type: [BuybackProductSchema], required: true })
  products: BuybackProductSchema[];

  @Prop({ type: String })
  additionalInfo?: string;
}

/**
 * Subdocumento para un producto en Donate Service
 */
@Schema({ _id: false })
export class DonateProductSchema {
  @Prop({ type: Types.ObjectId })
  productId?: Types.ObjectId;

  @Prop({ type: ProductSnapshotSchema })
  productSnapshot?: ProductSnapshotSchema;

  @Prop({ type: Boolean })
  needsDataWipe?: boolean;

  @Prop({ type: Boolean })
  needsCleaning?: boolean;

  @Prop({ type: String })
  comments?: string;
}

/**
 * Subdocumento para Donate Service
 * Permite solicitar donación de múltiples productos
 */
@Schema({ _id: false })
export class DonateServiceSchema {
  @Prop({ type: String, enum: ['Donate'], required: true })
  serviceCategory: 'Donate';

  @Prop({ type: [DonateProductSchema], required: true })
  products: DonateProductSchema[];

  @Prop({ type: String })
  additionalDetails?: string;
}

/**
 * Subdocumento para un producto en Cleaning Service
 */
@Schema({ _id: false })
export class CleaningProductSchema {
  @Prop({ type: Types.ObjectId })
  productId?: Types.ObjectId;

  @Prop({ type: ProductSnapshotSchema })
  productSnapshot?: ProductSnapshotSchema;

  @Prop({ type: String })
  desiredDate?: string;

  @Prop({ type: String, enum: ['Superficial', 'Deep'] })
  cleaningType?: string;

  @Prop({ type: String })
  additionalComments?: string;
}

/**
 * Subdocumento para Cleaning Service
 * Permite solicitar limpieza de múltiples productos (Computer o Other)
 */
@Schema({ _id: false })
export class CleaningServiceSchema {
  @Prop({ type: String, enum: ['Cleaning'], required: true })
  serviceCategory: 'Cleaning';

  @Prop({ type: [CleaningProductSchema], required: true })
  products: CleaningProductSchema[];

  @Prop({ type: String })
  additionalDetails?: string;
}

/**
 * Producto en Storage Service
 */
@Schema({ _id: false })
export class StorageProductSchema {
  @Prop({ type: Types.ObjectId })
  productId?: Types.ObjectId;

  @Prop({ type: ProductSnapshotSchema })
  productSnapshot?: ProductSnapshotSchema;

  @Prop({ type: String })
  approximateSize?: string;

  @Prop({ type: String })
  approximateWeight?: string;

  @Prop({ type: Number })
  approximateStorageDays?: number;

  @Prop({ type: String })
  additionalComments?: string;
}

/**
 * Subdocumento para Storage Service
 * Permite solicitar almacenamiento de múltiples productos en warehouse
 */
@Schema({ _id: false })
export class StorageServiceSchema {
  @Prop({ type: String, enum: ['Storage'], required: true })
  serviceCategory: 'Storage';

  @Prop({ type: [StorageProductSchema], required: true })
  products: StorageProductSchema[];

  @Prop({ type: String })
  additionalDetails?: string;
}

/**
 * Miembro origen en Offboarding Service
 */
@Schema({ _id: false })
export class OffboardingOriginMemberSchema {
  @Prop({ type: Types.ObjectId, required: true })
  memberId: Types.ObjectId;

  @Prop({ type: String, required: true })
  firstName: string;

  @Prop({ type: String, required: true })
  lastName: string;

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, required: true, maxlength: 2 })
  countryCode: string;
}

/**
 * Destino en Offboarding Service (discriminated union: Member/Office/Warehouse)
 */
@Schema({ _id: false })
export class OffboardingDestinationSchema {
  @Prop({
    type: String,
    enum: ['Member', 'Office', 'Warehouse'],
    required: true,
  })
  type: 'Member' | 'Office' | 'Warehouse';

  // Campos para destino Member
  @Prop({ type: Types.ObjectId })
  memberId?: Types.ObjectId;

  @Prop({ type: String })
  assignedMember?: string;

  @Prop({ type: String })
  assignedEmail?: string;

  // Campos para destino Office
  @Prop({ type: Types.ObjectId })
  officeId?: Types.ObjectId;

  @Prop({ type: String })
  officeName?: string;

  // Campos para destino Warehouse
  @Prop({ type: Types.ObjectId })
  warehouseId?: Types.ObjectId;

  @Prop({ type: String })
  warehouseName?: string;

  // Campo común para todos los tipos
  @Prop({ type: String, required: true, maxlength: 2 })
  countryCode: string;
}

/**
 * Producto en Offboarding Service
 */
@Schema({ _id: false })
export class OffboardingProductSchema {
  @Prop({ type: Types.ObjectId })
  productId?: Types.ObjectId;

  @Prop({ type: ProductSnapshotSchema })
  productSnapshot?: ProductSnapshotSchema;

  @Prop({ type: OffboardingDestinationSchema, required: true })
  destination: OffboardingDestinationSchema;
}

/**
 * Subdocumento para Offboarding Service
 * Permite offboardear múltiples productos de un miembro a diferentes destinos
 */
@Schema({ _id: false })
export class OffboardingServiceSchema {
  @Prop({ type: String, enum: ['Offboarding'], required: true })
  serviceCategory: 'Offboarding';

  @Prop({ type: OffboardingOriginMemberSchema, required: true })
  originMember: OffboardingOriginMemberSchema;

  @Prop({ type: Boolean, required: true })
  isSensitiveSituation: boolean;

  @Prop({ type: Boolean, required: true })
  employeeKnows: boolean;

  @Prop({ type: [OffboardingProductSchema], required: true, minlength: 1 })
  products: OffboardingProductSchema[];

  @Prop({ type: String })
  desirablePickupDate?: string;

  @Prop({ type: String, maxlength: 1000 })
  additionalDetails?: string;
}

/**
 * Destino en Logistics Service
 */
@Schema({ _id: false })
export class LogisticsDestinationSchema {
  @Prop({
    type: String,
    enum: ['Member', 'Office', 'Warehouse'],
    required: true,
  })
  type: 'Member' | 'Office' | 'Warehouse';

  @Prop({ type: String })
  memberId?: string;

  @Prop({ type: String })
  assignedMember?: string;

  @Prop({ type: String })
  assignedEmail?: string;

  @Prop({ type: String })
  officeId?: string;

  @Prop({ type: String })
  officeName?: string;

  @Prop({ type: String })
  warehouseId?: string;

  @Prop({ type: String })
  warehouseName?: string;

  @Prop({ type: String, required: true, maxlength: 2 })
  countryCode: string;
}

/**
 * Producto en Logistics Service
 */
@Schema({ _id: false })
export class LogisticsProductSchema {
  @Prop({ type: String })
  productId?: string;

  @Prop({ type: Object })
  productSnapshot?: any;

  @Prop({ type: LogisticsDestinationSchema, required: true })
  destination: LogisticsDestinationSchema;
}

/**
 * Logistics Service Schema
 */
@Schema({ discriminatorKey: 'serviceCategory' })
export class LogisticsServiceSchema {
  @Prop({ type: String, enum: ['Logistics'], required: true })
  serviceCategory: 'Logistics';

  @Prop({ type: [LogisticsProductSchema], required: true, minlength: 1 })
  products: LogisticsProductSchema[];

  @Prop({ type: String })
  desirablePickupDate?: string;

  @Prop({ type: String, maxlength: 1000 })
  additionalDetails?: string;
}
