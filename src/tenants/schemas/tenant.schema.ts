import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// import { genSalt, hash } from 'bcrypt';
import { Document, Types } from 'mongoose';

export const PROVIDERS = ['credentials', 'google', 'azure-ad'] as const;
export type Provider = (typeof PROVIDERS)[number];
@Schema({ timestamps: true })
export class Tenant extends Document {
  _id: Types.ObjectId;

  @Prop({ type: String, default: '' })
  tenantName: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, default: '' })
  image?: string;

  @Prop({ type: Number, required: false, default: 3 })
  computerExpiration: number;

  @Prop({
    type: Map,
    of: Boolean,
    default: new Map([
      ['Merchandising', false],
      ['Computer', true],
      ['Monitor', true],
      ['Audio', true],
      ['Peripherals', true],
      ['Other', true],
    ]),
  })
  isRecoverableConfig: Map<string, boolean>;

  // Widgets movidos al esquema de User (cada usuario tiene su configuración)

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Object, required: false })
  metadata?: Record<string, any>;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
