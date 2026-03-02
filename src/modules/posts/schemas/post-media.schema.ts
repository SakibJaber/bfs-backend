import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type PostMediaDocument = PostMedia & Document;

@Schema({ timestamps: true })
export class PostMedia {
  @Prop({ type: Types.ObjectId, ref: 'Post', index: true })
  postId: Types.ObjectId;

  @Prop({ enum: ['image', 'video'] })
  type: string;

  @Prop() url: string;
  @Prop() thumbnailUrl: string;

  @Prop({ default: 0 })
  order: number;
}

export const PostMediaSchema = SchemaFactory.createForClass(PostMedia);