import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', index: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  senderId: Types.ObjectId;

  @Prop() text: string;
  @Prop() mediaUrl: string;

  @Prop({ enum: ['text', 'image'], default: 'text' })
  messageType: string;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: [],
  })
  seenBy: Types.ObjectId[];
}

export const MessageSchema = SchemaFactory.createForClass(Message);
