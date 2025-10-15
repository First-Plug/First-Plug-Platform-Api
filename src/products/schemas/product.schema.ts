import {
  Prop,
  Schema as DecoratorSchema,
  SchemaFactory,
} from '@nestjs/mongoose';
import mongoose, { Document, Schema, SchemaTimestampsConfig } from 'mongoose';
import {
  Attribute,
  CATEGORIES,
  Category,
  STATES,
  Status,
  Condition,
  CONDITION,
} from '../interfaces/product.interface';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';
import { boolean } from 'zod';

export type ProductDocument = Product & Document & SchemaTimestampsConfig;

@DecoratorSchema({ timestamps: true })
export class Product {
  _id?: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: String,
  })
  name?: string;

  @Prop({ enum: CATEGORIES, required: true })
  category: Category;

  @Prop({ type: [{ key: String, value: Schema.Types.Mixed }], required: true })
  attributes: Attribute[];

  @Prop({
    enum: STATES,
    required: true,
  })
  status: Status;

  @Prop({ type: Boolean, required: true })
  recoverable?: boolean;

  @Prop({
    type: String,
    required: false,
    unique: true,
    sparse: true,
  })
  serialNumber?: string | null;

  @Prop({ type: String })
  assignedEmail?: string;

  @Prop({ type: String })
  assignedMember?: string;

  @Prop({ type: String })
  lastAssigned?: string;

  @Prop({ type: String })
  acquisitionDate?: string;

  @Prop({ type: String })
  location?: string;

  @Prop({ type: Schema.Types.ObjectId, ref: 'Office', required: false })
  officeId?: Schema.Types.ObjectId;

  @Prop({
    type: {
      officeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Office',
        required: false,
      },
      officeCountryCode: {
        type: String,
        required: false,
      },
      officeName: {
        type: String,
        required: false,
      },
      assignedAt: {
        type: Date,
        required: false,
      },
      isDefault: {
        type: Boolean,
        required: false,
      },
    },
    required: false,
  })
  office?: {
    officeId?: mongoose.Schema.Types.ObjectId;
    officeCountryCode?: string;
    officeName?: string;
    assignedAt?: Date;
    isDefault?: boolean;
  };

  @Prop({
    type: {
      amount: { type: Number },
      currencyCode: {
        type: String,
        enum: [
          'USD',
          'AED',
          'AFN',
          'ALL',
          'AMD',
          'ANG',
          'AOA',
          'ARS',
          'AUD',
          'AWG',
          'AZN',
          'BAM',
          'BBD',
          'BDT',
          'BGN',
          'BHD',
          'BIF',
          'BMD',
          'BND',
          'BOB',
          'BRL',
          'BSD',
          'BTN',
          'BWP',
          'BYN',
          'BZD',
          'CAD',
          'CDF',
          'CHF',
          'CLP',
          'CNY',
          'COP',
          'CRC',
          'CUP',
          'CVE',
          'CZK',
          'DJF',
          'DKK',
          'DOP',
          'DZD',
          'EGP',
          'ERN',
          'ETB',
          'EUR',
          'FJD',
          'GBP',
          'GEL',
          'GHS',
          'GMD',
          'GNF',
          'GTQ',
          'GYD',
          'HKD',
          'HNL',
          'HRK',
          'HTG',
          'HUF',
          'IDR',
          'ILS',
          'INR',
          'IQD',
          'IRR',
          'ISK',
          'JMD',
          'JOD',
          'JPY',
          'KES',
          'KGS',
          'KHR',
          'KMF',
          'KPW',
          'KRW',
          'KWD',
          'KYD',
          'KZT',
          'LAK',
          'LBP',
          'LKR',
          'LRD',
          'LSL',
          'LYD',
          'MAD',
          'MDL',
          'MGA',
          'MKD',
          'MMK',
          'MNT',
          'MOP',
          'MRU',
          'MUR',
          'MVR',
          'MWK',
          'MXN',
          'MYR',
          'MZN',
          'NAD',
          'NGN',
          'NIO',
          'NOK',
          'NPR',
          'NZD',
          'OMR',
          'PAB',
          'PEN',
          'PGK',
          'PHP',
          'PKR',
          'PLN',
          'PYG',
          'QAR',
          'RON',
          'RSD',
          'RUB',
          'RWF',
          'SAR',
          'SBD',
          'SCR',
          'SDG',
          'SEK',
          'SGD',
          'SLL',
          'SOS',
          'SRD',
          'STN',
          'SYP',
          'SZL',
          'THB',
          'TJS',
          'TMT',
          'TND',
          'TOP',
          'TRY',
          'TTD',
          'TWD',
          'TZS',
          'UAH',
          'UGX',
          'UYU',
          'UZS',
          'VES',
          'VND',
          'VUV',
          'WST',
          'XAF',
          'XCD',
          'XOF',
          'YER',
          'ZAR',
          'ZMW',
          'ZWL',
          'TBC',
        ],
      },
    },
    required: false,
  })
  price?: {
    amount: number;
    currencyCode: string;
  };

  @Prop({ type: String })
  additionalInfo?: string;

  @Prop({
    enum: CONDITION,
    required: false,
  })
  productCondition: Condition;

  @Prop({ type: boolean })
  fp_shipment: boolean;

  @Prop({ type: Boolean, default: false })
  activeShipment?: boolean;

  // Objeto completo para datos de FP warehouse
  @Prop({
    type: {
      warehouseId: { type: Schema.Types.ObjectId },
      warehouseCountryCode: { type: String },
      warehouseName: { type: String },
      assignedAt: { type: Date },
      status: {
        type: String,
        enum: ['STORED', 'IN_TRANSIT', 'IN_TRANSIT_IN', 'IN_TRANSIT_OUT'],
      },
    },
    required: false,
  })
  fpWarehouse?: {
    warehouseId?: mongoose.Schema.Types.ObjectId;
    warehouseCountryCode?: string;
    warehouseName?: string;
    assignedAt?: Date;
    status?: 'STORED' | 'IN_TRANSIT' | 'IN_TRANSIT_IN' | 'IN_TRANSIT_OUT';
  };

  @Prop({ type: String })
  lastSerialNumber?: string;

  // === CAMPOS ADICIONALES PARA SUPERADMIN ===
  @Prop({ type: String, required: false })
  createdBy?: string; // 'SuperAdmin' | 'User' | email

  isDeleted?: boolean;

  deleteAt?: string | null;
}

export const ProductSchema =
  SchemaFactory.createForClass(Product).plugin(softDeletePlugin);

// Índices para optimizar consultas de warehouse
ProductSchema.index({ 'fpWarehouse.warehouseId': 1, 'fpWarehouse.status': 1 });
ProductSchema.index({ 'fpWarehouse.warehouseCountryCode': 1, location: 1 });
ProductSchema.index({ location: 1, 'fpWarehouse.warehouseCountryCode': 1 });
