import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';

@Schema({ timestamps: true })
export class Office extends Document {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Boolean, default: true })
  isDefault: boolean;

  @Prop({ type: String, default: '' })
  email: string;

  @Prop({ type: String, default: '' })
  phone: string;

  @Prop({ type: String, default: '' })
  country: string;

  @Prop({ type: String, default: '' })
  state: string;

  @Prop({ type: String, default: '' })
  city: string;

  @Prop({ type: String, default: '' })
  zipCode: string;

  @Prop({ type: String, default: '' })
  address: string;

  @Prop({ type: String, default: '' })
  apartment: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const OfficeSchema =
  SchemaFactory.createForClass(Office).plugin(softDeletePlugin);
