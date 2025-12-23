import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class ShipmentMetadata extends Document {
  @Prop({ type: String })
  _id: string;

  @Prop({ required: true, default: 0 })
  lastOrderNumber: number;

  @Prop({ required: true, default: 0 })
  lastQuoteNumber: number;
}

export const ShipmentMetadataSchema =
  SchemaFactory.createForClass(ShipmentMetadata);
