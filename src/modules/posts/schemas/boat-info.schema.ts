import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BoatInfoDocument = BoatInfo & Document;

@Schema({ timestamps: true })
export class BoatInfo {
  @Prop({
    type: Types.ObjectId,
    ref: 'Post',
    required: true,
    unique: true,
    index: true,
  })
  postId: Types.ObjectId;

  @Prop({ trim: true, index: true })
  boatType: string;

  @Prop({ trim: true })
  category: string;

  @Prop({ trim: true })
  hullMaterial: string;

  /** Length in feet */
  @Prop({ min: 0, index: true })
  length: number;

  /** Manufacturing year */
  @Prop({ min: 1900, max: 2100, index: true })
  year: number;
}

export const BoatInfoSchema = SchemaFactory.createForClass(BoatInfo);
BoatInfoSchema.index({ boatType: 1, year: 1, length: 1 });
