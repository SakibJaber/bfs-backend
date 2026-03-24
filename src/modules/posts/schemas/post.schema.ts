import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop({ trim: true })
  title: string;

  @Prop() caption: string;

  @Prop({ index: true })
  location: string;

  @Prop({ index: true })
  price: number;

  @Prop({ type: Number, default: 0 })
  shareCount: number;

  @Prop({ type: Number, default: 0 })
  likesCount: number;

  @Prop({ type: Number, default: 0 })
  commentsCount: number;

  @Prop()
  displayTitle: string;

  @Prop()
  userName: string;

  @Prop()
  userAvatarUrl: string;

  @Prop({ enum: ['active', 'deleted'], default: 'active', index: true })
  status: string;
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ createdAt: -1 });
PostSchema.index({ status: 1, createdAt: -1 });
PostSchema.index({ caption: 'text', location: 'text' });
