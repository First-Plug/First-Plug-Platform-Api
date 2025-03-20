import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';

export type ShipmentDocument = Shipment & Document;

@Schema({ timestamps: true })
export class Shipment extends Document {
  @Prop({ required: true })
  order_id: string;

  @Prop({ required: true })
  shipment_status: string;
}

export const ShipmentSchema =
  SchemaFactory.createForClass(Shipment).plugin(softDeletePlugin);
