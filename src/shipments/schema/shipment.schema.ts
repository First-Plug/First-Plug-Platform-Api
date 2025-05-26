import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Schema as MongooseSchema } from 'mongoose';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';
import {
  SHIPMENT_STATUS,
  SHIPMENT_TYPE,
  ShipmentStatus,
  ShipmentType,
} from '../interface/shipment.interface';

export type ShipmentDocument = Shipment & Document;

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
          'ARS',
          'BOB',
          'BRL',
          'CLP',
          'COP',
          'CRC',
          'GTQ',
          'HNL',
          'ILS',
          'MXN',
          'NIO',
          'PAB',
          'PEN',
          'PYG',
          'EUR',
          'UYU',
          'VES',
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
    type: {
      address: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
      apartment: String,
      phone: String,
      personalEmail: String,
      assignedEmail: String,
      dni: String,
      desirableDate: String,
    },
    required: false,
  })
  originDetails?: Record<string, string>;

  @Prop({ type: String, required: true })
  destination: string;

  @Prop({
    type: {
      address: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
      apartment: String,
      phone: String,
      personalEmail: String,
      assignedEmail: String,
      dni: String,
      desirableDate: String,
    },
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
