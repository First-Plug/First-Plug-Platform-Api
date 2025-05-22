import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

@Schema({ timestamps: true, collection: 'historial' })
export class History {
  @Prop({ type: mongoose.Schema.Types.ObjectId, auto: true })
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true })
  actionType: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  itemType: string;

  @Prop({
    type: {
      oldData: { type: Object },
      newData: { type: Object },
      context: { type: String },
    },
    required: true,
  })
  changes: {
    oldData: Record<string, any>;
    newData: Record<string, any>;
    context: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

export const HistorySchema = SchemaFactory.createForClass(History);
