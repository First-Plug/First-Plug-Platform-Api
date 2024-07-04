import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Team extends Document {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: String,
    index: true,
    unique: true,
  })
  name: string;

  @Prop({ type: String })
  color: string;
}

export const TeamSchema = SchemaFactory.createForClass(Team);
