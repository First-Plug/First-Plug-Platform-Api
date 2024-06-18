import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, SchemaTimestampsConfig } from 'mongoose';
import { Product } from '../../products/schemas/product.schema';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';

export type MemberDocument = Member & Document & SchemaTimestampsConfig;

@Schema({ timestamps: true })
export class Member {
  _id?: mongoose.Schema.Types.ObjectId;

  @Prop({ type: String, required: true })
  firstName: string;

  @Prop({ type: String, required: true })
  lastName: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  email: string;

  @Prop({ type: String })
  picture?: string;

  @Prop({ type: String })
  position?: string;

  @Prop({ type: String })
  personalEmail?: string;

  @Prop({ type: String })
  birthDate?: string;

  @Prop({ type: String })
  phone?: string;

  @Prop({ type: String })
  city?: string;

  @Prop({ type: String })
  country?: string;

  @Prop({ type: String })
  zipCode?: string;

  @Prop({ type: String })
  address?: string;

  @Prop({ type: String })
  apartment?: string;

  @Prop({ type: String })
  additionalInfo?: string;

  @Prop({ type: String })
  startDate?: string;

  @Prop({ type: [{ type: Product }], default: [] })
  products: Product[];

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Team' })
  team?: mongoose.Schema.Types.ObjectId;
}

export const MemberSchema =
  SchemaFactory.createForClass(Member).plugin(softDeletePlugin);
