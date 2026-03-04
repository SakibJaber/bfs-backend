import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  actorId: Types.ObjectId;

  @Prop({
    enum: ['like', 'comment', 'reply', 'save', 'message', 'warning'],
  })
  type: string;

  @Prop({ type: Types.ObjectId, ref: 'Post', default: null })
  postId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Message', default: null })
  messageId: Types.ObjectId;

  @Prop({ default: false })
  isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, isRead: 1 });