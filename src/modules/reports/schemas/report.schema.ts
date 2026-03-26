import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReportDocument = Report & Document;

@Schema({ timestamps: true })
export class Report {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  reporterId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  targetId: Types.ObjectId;

  @Prop({ required: true, enum: ['user', 'post'], index: true })
  targetType: string;

  @Prop({ required: true, trim: true })
  note: string;

  @Prop()
  image?: string;

  @Prop({
    enum: ['pending', 'resolved', 'dismissed'],
    default: 'pending',
    index: true,
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolvedBy?: Types.ObjectId;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

ReportSchema.index({ createdAt: -1 });
