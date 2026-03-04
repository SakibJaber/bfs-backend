import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProfileDocument = Profile & Document;

@Schema({ timestamps: true })
export class Profile {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop() name: string;
  @Prop() bio: string;
  @Prop() phone: string;
  @Prop() avatarUrl: string;

  @Prop({
    type: {
      facebook: { type: String, default: null },
      instagram: { type: String, default: null },
      twitter: { type: String, default: null },
    },
    default: {},
  })
  socialLinks: { facebook?: string; instagram?: string; twitter?: string };

  @Prop({ default: 0 })
  postsCount: number;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);

// Index for fast profile lookup by userId (already unique, but explicit for clarity)
ProfileSchema.index({ userId: 1 });
