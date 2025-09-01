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

  @Prop({ type: String })
  lastSerialNumber?: string;

  isDeleted?: boolean;

  deleteAt?: string | null;
}

export const ProductSchema =
  SchemaFactory.createForClass(Product).plugin(softDeletePlugin);
