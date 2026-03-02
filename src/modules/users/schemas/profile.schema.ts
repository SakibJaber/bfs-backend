import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProfileDocument = Profile & Document;

@Schema({ timestamps: true })
export class Profile {
  @Prop({ type: Types.ObjectId, ref: 'User', unique: true })
  userId: Types.ObjectId;

  @Prop()
   name: string;
  @Prop() bio: string;
  @Prop() phone: string;
  @Prop() avatarUrl: string;

  @Prop({
    type: {
      facebook: String,
      instagram: String,
      twitter: String,
    },
    default: {},
  })
  socialLinks: Record<string, string>;

  @Prop({ default: 0 }) followersCount: number;
  @Prop({ default: 0 }) followingCount: number;
  @Prop({ default: 0 }) postsCount: number;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);