import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { genSalt, hash } from 'bcrypt';
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

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ enum: PROVIDERS, required: false })
  accountProvider: Provider;

  @Prop({ type: String, default: '' })
  image?: string;

  @Prop({ type: String, required: false })
  password: string;

  @Prop({ type: String, required: false })
  salt: string;

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

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        order: { type: Number, required: true },
      },
    ],
    default: [
      { id: 'my-assets', order: 0 },
      { id: 'computer-updates', order: 1 },
      { id: 'upcoming-birthdays', order: 2 },
      { id: 'members-by-country', order: 3 },
    ],
  })
  widgets: { id: string; order: number }[];
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);

TenantSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await genSalt(10);

    this.salt = salt;
    this.password = await hash(this.password, salt);
    next();
  } catch (error) {
    return next(error);
  }
});
