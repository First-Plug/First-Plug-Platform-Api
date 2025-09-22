import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Schema as MongooseSchema } from 'mongoose';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';
import {
  SHIPMENT_STATUS,
  SHIPMENT_TYPE,
  ShipmentStatus,
  ShipmentType,
} from '../interface/shipment.interface';
import { CountryHelper } from '../../common/helpers/country.helper';

export type ShipmentDocument = Shipment & Document;

// Schema para detalles de ubicación (origen/destino)
const LocationDetailsSchema = new MongooseSchema(
  {
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: {
      type: String,
      default: '',
      validate: {
        validator: function (value: string) {
          // Permitir valores vacíos para compatibilidad durante migración
          if (!value || value === '') return true;
          return CountryHelper.isValidCountryCode(value);
        },
        message:
          'Country must be a valid ISO 3166-1 alpha-2 code (e.g., AR, BR, US) or special internal code (OO, FP)',
      },
    },
    zipCode: { type: String, default: '' },
    apartment: { type: String, default: '' },
    phone: { type: String, default: '' },
    personalEmail: { type: String, default: '' },
    assignedEmail: { type: String, default: '' },
    email: { type: String, default: '' },
    dni: { type: String, default: '' },
    desirableDate: { type: String, default: '' },
  },
  { _id: false },
);

@Schema({ timestamps: true })
export class Shipment {
  _id?: mongoose.Schema.Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  order_id: string;

  @Prop({ type: String, required: true })
  tenant: string;

  @Prop({ type: Number, required: true })
  quantity_products: number;

  @Prop({ type: Date, required: true, default: Date.now })
  order_date: Date;

  @Prop({
    required: true,
    enum: SHIPMENT_TYPE,
    default: 'TBC',
  })
  shipment_type: ShipmentType;

  @Prop({ type: String, required: false })
  trackingURL?: string;

  @Prop({
    required: true,
    enum: SHIPMENT_STATUS,
    default: 'In Preparation',
  })
  shipment_status: ShipmentStatus;

  @Prop({
    type: {
      amount: { type: Number, default: null },
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
        default: 'TBC',
      },
    },
    required: false,
  })
  price?: {
    amount: number;
    currencyCode: string;
  };

  @Prop({ type: String, required: true })
  origin: string;

  @Prop({
    type: LocationDetailsSchema,
    required: false,
  })
  originDetails?: Record<string, string>;

  @Prop({ type: String, required: true })
  destination: string;

  @Prop({
    type: LocationDetailsSchema,
    required: false,
  })
  destinationDetails?: Record<string, string>;

  @Prop({ type: String, required: true, default: 'shipments' })
  type: string;

  @Prop({
    type: [{ type: mongoose.Types.ObjectId, ref: 'Product' }],
    default: [],
  })
  products: mongoose.Types.ObjectId[];

  @Prop({
    type: [
      {
        _id: MongooseSchema.Types.ObjectId,
        name: String,
        category: String,
        attributes: [{ key: String, value: MongooseSchema.Types.Mixed }],
        status: String,
        recoverable: Boolean,
        serialNumber: String,
        assignedEmail: String,
        assignedMember: String,
        lastAssigned: String,
        acquisitionDate: String,
        location: String,
        price: { amount: Number, currencyCode: String },
        additionalInfo: String,
        productCondition: String,
        fp_shipment: Boolean,
      },
    ],
    required: false,
  })
  snapshots?: Array<{
    _id: mongoose.Schema.Types.ObjectId;
    name?: string;
    category: string;
    attributes: { key: string; value: any }[];
    status: string;
    recoverable?: boolean;
    serialNumber?: string;
    assignedEmail?: string;
    assignedMember?: string;
    lastAssigned?: string;
    acquisitionDate?: string;
    location?: string;
    price?: { amount: number; currencyCode: string };
    additionalInfo?: string;
    productCondition: string;
    fp_shipment: boolean;
  }>;

  isDeleted?: boolean;
  deleteAt?: string | null;
}

export const ShipmentSchema =
  SchemaFactory.createForClass(Shipment).plugin(softDeletePlugin);
