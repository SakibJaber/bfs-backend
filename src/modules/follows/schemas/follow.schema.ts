import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type FollowDocument = Follow & Document;

@Schema({ timestamps: true })
export class Follow {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  followerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  followingId: Types.ObjectId;
}

export const FollowSchema = SchemaFactory.createForClass(Follow);

FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });