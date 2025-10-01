import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type GlobalProductDocument = GlobalProduct & Document;

// Subdocumento para atributos del producto
@Schema({ _id: false })
export class ProductAttribute {
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  value: string;
}

// Subdocumento para datos de warehouse
@Schema({ _id: false })
export class FpWarehouseData {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  warehouseId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  warehouseCountryCode: string;

  @Prop({ required: true })
  warehouseName: string;

  @Prop({ type: Date, default: Date.now })
  assignedAt: Date;

  @Prop({
    enum: ['STORED', 'IN_TRANSIT_IN', 'IN_TRANSIT_OUT'],
    default: 'STORED',
  })
  status: 'STORED' | 'IN_TRANSIT_IN' | 'IN_TRANSIT_OUT';
}

// Subdocumento para datos de miembro asignado
@Schema({ _id: false })
export class AssignedMemberData {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  memberId: MongooseSchema.Types.ObjectId;

  @Prop({ required: false })
  memberEmail: string;

  @Prop({ required: false })
  memberName: string;

  @Prop({ type: Date, default: Date.now })
  assignedAt: Date;
}

// Schema principal del producto global
@Schema({
  timestamps: true,
  collection: 'global_products',
})
export class GlobalProduct {
  // === DATOS DEL TENANT ===
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  tenantId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantName: string;

  // === REFERENCIA AL PRODUCTO ORIGINAL ===
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  originalProductId: MongooseSchema.Types.ObjectId;

  @Prop({ enum: ['products', 'members'], required: true })
  sourceCollection: 'products' | 'members';

  // === DATOS COMPLETOS DEL PRODUCTO ===
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  category: string;

  @Prop({ required: true, index: true })
  status: string;

  @Prop({ required: true, index: true })
  location: string;

  @Prop([ProductAttribute])
  attributes: ProductAttribute[];

  @Prop()
  serialNumber?: string;

  @Prop()
  assignedEmail?: string;

  @Prop()
  assignedMember?: string;

  @Prop()
  lastAssigned?: string;

  @Prop()
  acquisitionDate?: string;

  @Prop({
    type: {
      amount: { type: Number },
      currencyCode: { type: String },
    },
    required: false,
  })
  price?: {
    amount: number;
    currencyCode: string;
  };

  @Prop()
  additionalInfo?: string;

  @Prop()
  productCondition?: string; // 'Optimal', 'Defective', 'Unusable'

  @Prop({ type: Boolean, default: false })
  recoverable?: boolean;

  @Prop({ type: Boolean, default: false })
  fp_shipment?: boolean;

  @Prop({ type: Boolean, default: false })
  activeShipment?: boolean;

  @Prop()
  imageUrl?: string;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  // === DATOS ESPECÍFICOS DE UBICACIÓN ===

  // Datos del warehouse (cuando location = 'FP warehouse')
  @Prop({ type: FpWarehouseData, required: false })
  fpWarehouse?: FpWarehouseData;

  // Datos del miembro (cuando location = 'Employee')
  @Prop({ type: AssignedMemberData, required: false })
  memberData?: AssignedMemberData;

  // === METADATOS DE SINCRONIZACIÓN ===
  @Prop({ type: Date, default: Date.now })
  lastSyncedAt: Date;

  @Prop({ type: Date })
  sourceUpdatedAt?: Date;

  // === CAMPOS CALCULADOS ===
  @Prop({ type: Boolean, index: true })
  isComputer: boolean; // true si category === 'Computer'

  @Prop({ type: Boolean, index: true })
  inFpWarehouse: boolean; // true si location === 'FP warehouse'

  @Prop({ type: Boolean, index: true })
  isAssigned: boolean; // true si location === 'Assigned'
}

export const GlobalProductSchema = SchemaFactory.createForClass(GlobalProduct);

// === ÍNDICES PARA OPTIMIZAR CONSULTAS ===

// Índice único para evitar duplicados
GlobalProductSchema.index(
  { tenantId: 1, originalProductId: 1 },
  { unique: true },
);

// Índices para métricas de warehouse
GlobalProductSchema.index({
  inFpWarehouse: 1,
  'fpWarehouse.warehouseCountryCode': 1,
});
GlobalProductSchema.index({
  'fpWarehouse.warehouseId': 1,
  inFpWarehouse: 1,
});

// Índices para búsquedas generales
GlobalProductSchema.index({ category: 1, location: 1 });
GlobalProductSchema.index({ tenantName: 1, category: 1 });
GlobalProductSchema.index({ status: 1, location: 1 });

// Índice para productos asignados
GlobalProductSchema.index({
  isAssigned: 1,
  'assignedMember.memberEmail': 1,
});

// === MIDDLEWARE PARA CAMPOS CALCULADOS ===
GlobalProductSchema.pre('save', function (next) {
  // Calcular campos derivados
  this.isComputer = this.category === 'Computer';
  this.inFpWarehouse = this.location === 'FP warehouse';
  this.isAssigned = this.location === 'Employee';

  // Actualizar timestamp de sincronización
  this.lastSyncedAt = new Date();

  next();
});

// === MÉTODOS ESTÁTICOS ===
GlobalProductSchema.statics.findByTenant = function (tenantName: string) {
  return this.find({ tenantName, isDeleted: { $ne: true } });
};

GlobalProductSchema.statics.findInWarehouse = function (warehouseId: string) {
  return this.find({
    inFpWarehouse: true,
    'fpWarehouse.warehouseId': warehouseId,
    isDeleted: { $ne: true },
  });
};

GlobalProductSchema.statics.getWarehouseMetrics = function (
  warehouseId: string,
) {
  return this.aggregate([
    {
      $match: {
        inFpWarehouse: true,
        'fpWarehouse.warehouseId': warehouseId,
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        computers: { $sum: { $cond: ['$isComputer', 1, 0] } },
        nonComputers: { $sum: { $cond: ['$isComputer', 0, 1] } },
        tenants: { $addToSet: '$tenantName' },
      },
    },
    {
      $project: {
        _id: 0,
        total: 1,
        computers: 1,
        nonComputers: 1,
        distinctTenants: { $size: '$tenants' },
      },
    },
  ]);
};
