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

  isDeleted?: boolean;

  deleteAt?: string | null;
}

export const ProductSchema =
  SchemaFactory.createForClass(Product).plugin(softDeletePlugin);
