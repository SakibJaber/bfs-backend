import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type LikeDocument = Like & Document;

@Schema({ timestamps: true })
export class Like {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', index: true })
  postId: Types.ObjectId;
}

export const LikeSchema = SchemaFactory.createForClass(Like);

LikeSchema.index({ userId: 1, postId: 1 }, { unique: true });