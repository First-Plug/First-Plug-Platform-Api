import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';
import {
  SHIPMENT_STATUS,
  SHIPMENT_TYPE,
  ShipmentStatus,
  ShipmentType,
} from '../interfaces/shipment.interface';

@Schema({ timestamps: true })
export class Shipment extends Document {
  _id?: mongoose.Schema.Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  order_id: string;

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

  @Prop({ type: String, required: true })
  destination: string;

  @Prop({ type: String, required: true, default: 'shipments' })
  type: string;

  @Prop({
    type: [{ type: mongoose.Types.ObjectId, ref: 'PRODUCT_MODEL' }],
    default: [],
  })
  products: mongoose.Types.ObjectId[];
}

export const ShipmentSchema =
  SchemaFactory.createForClass(Shipment).plugin(softDeletePlugin);
