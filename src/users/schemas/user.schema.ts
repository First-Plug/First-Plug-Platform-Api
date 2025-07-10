import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';

export const PROVIDERS = ['credentials', 'google', 'azure-ad'] as const;
export type Provider = (typeof PROVIDERS)[number];

@Schema({ timestamps: true })
export class User extends Document {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, required: false })
  password: string;

  @Prop({ type: String, required: false })
  salt: string;

  @Prop({ enum: PROVIDERS, required: false })
  accountProvider: Provider;

  @Prop({ required: false, default: 'user' })
  role?: string;

  @Prop({ type: String, required: true })
  firstName: string;

  @Prop({ type: String, required: true })
  lastName: string;

  @Prop({ type: String, required: false, default: '' })
  phone: string;

  @Prop({ type: String, required: false, default: '' })
  country: string;

  @Prop({ type: String, required: false, default: '' })
  city: string;

  @Prop({ type: String, required: false, default: '' })
  state: string;

  @Prop({ type: String, required: false, default: '' })
  zipCode: string;

  @Prop({ type: String, required: false, default: '' })
  address: string;

  @Prop({ type: String, required: false, default: '' })
  apartment: string;

  @Prop({ type: String, default: '' })
  image?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const UserSchema =
  SchemaFactory.createForClass(User).plugin(softDeletePlugin);
