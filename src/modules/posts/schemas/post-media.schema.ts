import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostMediaDocument = PostMedia & Document;

@Schema({ timestamps: true })
export class PostMedia {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  postId: Types.ObjectId;

  @Prop({ required: true, enum: ['image', 'video'] })
  type: 'image' | 'video';

  /** Full public S3 URL */
  @Prop({ required: true })
  url: string;

  /** For videos: URL of generated thumbnail */
  @Prop()
  thumbnailUrl: string;

  /** Display order (0-based) */
  @Prop({ default: 0, min: 0 })
  order: number;

  /** Duration in seconds — used to enforce ≤10 s rule */
  @Prop({ default: 0, min: 0 })
  durationSeconds: number;
}

export const PostMediaSchema = SchemaFactory.createForClass(PostMedia);
PostMediaSchema.index({ postId: 1, order: 1 });
