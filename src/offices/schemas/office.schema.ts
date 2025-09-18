import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CountryHelper } from '../../common/helpers/country.helper';
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

  @Prop({
    type: String,
    default: '',
    validate: {
      validator: function (value: string) {
        // Permitir valores vacíos para compatibilidad durante migración
        if (!value || value === '') return true;
        return CountryHelper.isValidCountryCode(value);
      },
      message:
        'Country must be a valid ISO 3166-1 alpha-2 code (e.g., AR, BR, US) or special internal code (OO, FP)',
    },
  })
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

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const OfficeSchema =
  SchemaFactory.createForClass(Office).plugin(softDeletePlugin);
