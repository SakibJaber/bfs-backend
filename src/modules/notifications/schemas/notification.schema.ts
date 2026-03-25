import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId: Types.ObjectId;

  @Prop({
    enum: ['like', 'comment', 'reply', 'save', 'message', 'warning', 'follow'],
    required: true,
  })
  type: string;

  @Prop({ type: Types.ObjectId, ref: 'Post', default: null })
  postId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Message', default: null })
  messageId: Types.ObjectId;

  @Prop({ default: '' })
  message: string;

  @Prop({ default: false })
  isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
