import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop() caption: string;

  @Prop({ index: true })
  location: string;

  @Prop({ index: true })
  price: number;

  @Prop({ enum: ['active', 'deleted'], default: 'active' })
  status: string;
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ caption: 'text', location: 'text' });