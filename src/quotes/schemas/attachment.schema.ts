import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * AttachmentSchema - Subdocumento para adjuntos en servicios IT Support
 * Se guarda a nivel tenant (cada tenant tiene su DB)
 * 
 * Propiedades:
 * - provider: 'cloudinary' (MVP) o 's3' (plan de salida)
 * - publicId: ID único en el provider (necesario para borrar)
 * - secureUrl: URL pública del recurso (para Slack, UI, etc.)
 * - mimeType: tipo MIME (image/jpeg, image/png, etc.)
 * - bytes: tamaño en bytes
 * - originalName: nombre original del archivo
 * - createdAt: fecha de creación
 * - expiresAt: fecha de expiración (30 días desde creación)
 */
@Schema({ _id: false, timestamps: false })
export class AttachmentSchema {
  @Prop({
    type: String,
    enum: ['cloudinary', 's3'],
    required: true,
    default: 'cloudinary',
  })
  provider: 'cloudinary' | 's3';

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  publicId: string;

  @Prop({
    type: String,
    required: true,
  })
  secureUrl: string;

  @Prop({
    type: String,
    required: true,
    enum: ['image/jpeg', 'image/png', 'image/webp'],
  })
  mimeType: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
    max: 5242880, // 5MB en bytes
  })
  bytes: number;

  @Prop({
    type: String,
    required: false,
  })
  originalName?: string;

  @Prop({
    type: String,
    required: false,
  })
  resourceType?: string;

  @Prop({
    type: Date,
    required: true,
    default: () => new Date(),
  })
  createdAt: Date;

  @Prop({
    type: Date,
    required: true,
    index: true, // índice para búsquedas de expiración
  })
  expiresAt: Date;
}

export const AttachmentSchemaFactory = SchemaFactory.createForClass(
  AttachmentSchema,
);

export type AttachmentDocument = AttachmentSchema & Document;

