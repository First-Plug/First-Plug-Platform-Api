import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ShipmentGlobalMetadataDocument = ShipmentGlobalMetadata & Document;

@Schema({ collection: 'shipment_global_metadata' })
export class ShipmentGlobalMetadata {
  @Prop({ required: true, unique: true })
  _id: string;

  @Prop({ required: true, default: 0 })
  currentValue: number;
}

export const ShipmentGlobalMetadataSchema = SchemaFactory.createForClass(
  ShipmentGlobalMetadata,
);
