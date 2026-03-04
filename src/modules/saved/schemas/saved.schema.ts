import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type SavedDocument = Saved & Document;

@Schema({ timestamps: true })
export class Saved {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', index: true })
  postId: Types.ObjectId;
}

export const SavedSchema = SchemaFactory.createForClass(Saved);

SavedSchema.index({ userId: 1, postId: 1 }, { unique: true });