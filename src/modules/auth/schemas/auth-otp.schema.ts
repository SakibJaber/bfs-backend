import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuthOtpDocument = AuthOtp & Document;

export type OtpType = 'verification' | 'forgot_password';

@Schema({ timestamps: true })
export class AuthOtp {
  @Prop({ required: true, index: true })
  email: string;

  @Prop({ required: true })
  otp: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ required: true, enum: ['verification', 'forgot_password'] })
  type: OtpType;
}

export const AuthOtpSchema = SchemaFactory.createForClass(AuthOtp);

// TTL index: MongoDB will auto-delete documents once expiresAt is past
AuthOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for fast lookups by email + type
AuthOtpSchema.index({ email: 1, type: 1 });
