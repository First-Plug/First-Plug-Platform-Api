import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class ShipmentMetadata extends Document {
  @Prop({ required: true, default: 0 })
  lastOrderNumber: number;
}

export const ShipmentMetadataSchema =
  SchemaFactory.createForClass(ShipmentMetadata);
