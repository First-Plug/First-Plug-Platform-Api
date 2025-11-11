import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, SchemaTimestampsConfig, Types } from 'mongoose';
import { Product } from '../../products/schemas/product.schema';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';
import { CountryHelper } from '../../common/helpers/country.helper';

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

  @Prop({
    type: String,
    validate: {
      validator: function (value: string) {
        // Permitir valores vacíos/null para compatibilidad durante migración
        if (!value || value === '') return true;
        // Permitir ubicaciones especiales
        if (CountryHelper.isSpecialLocation(value)) return true;
        // Validar códigos ISO
        const normalized = CountryHelper.normalizeCountryCode(value);
        return CountryHelper.isISOCountryCode(normalized);
      },
      message:
        'Country must be a valid ISO 3166-1 alpha-2 code (e.g., AR, BR, US) or special location (Our office, FP warehouse)',
    },
  })
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

  @Prop({ type: Types.ObjectId, ref: 'Team' })
  team?: Types.ObjectId;

  @Prop({
    type: String,
    required: false,
    unique: true,
    sparse: true,
    get: (v: any) => (v ? String(v) : v),
    set: (v: any) => (v ? String(v) : v),
  })
  dni?: string;

  @Prop({ type: Boolean, default: false })
  activeShipment?: boolean;
}

export const MemberSchema =
  SchemaFactory.createForClass(Member).plugin(softDeletePlugin);
