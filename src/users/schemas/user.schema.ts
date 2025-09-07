import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { genSalt, hash } from 'bcrypt';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';
import { HydratedDocument } from 'mongoose';

export const PROVIDERS = ['credentials', 'google', 'azure-ad'] as const;
export type Provider = (typeof PROVIDERS)[number];
export type UserStatus = 'pending' | 'active';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  email: string;

  @Prop({ type: String, required: false })
  personalEmail: string;

  @Prop({ type: String, required: false })
  password: string;

  @Prop({ type: String, required: false })
  salt: string;

  @Prop({ enum: PROVIDERS, required: false })
  accountProvider: Provider;

  @Prop({
    type: String,
    enum: ['user', 'superadmin', 'admin'],
    default: 'user',
    required: false,
  })
  role?: string;

  @Prop({ type: String, required: true })
  firstName: string;

  @Prop({ type: String, required: false, default: '' })
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

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: false })
  tenantId?: Types.ObjectId;

  @Prop({ type: String, enum: ['pending', 'active'], default: 'pending' })
  status: UserStatus;

  @Prop({ default: true })
  isActive: boolean;

  // Configuración de widgets del dashboard (nivel usuario)
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
      { id: 'latest-activity', order: 4 },
    ],
  })
  widgets: { id: string; order: number }[];

  // Para usuarios del esquema viejo que tienen tenantName directo
  @Prop({ type: String, required: false })
  tenantName?: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date, required: false })
  deletedAt?: Date;
}

export const UserSchema =
  SchemaFactory.createForClass(User).plugin(softDeletePlugin);

UserSchema.pre<UserDocument>('save', async function (next) {
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
