import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BoatEngineDocument = BoatEngine & Document;

const singleEngineDefinition = {
  engineType: { type: String, trim: true },
  fuelType: { type: String, trim: true },
  engineMake: { type: String, trim: true },
  engineModel: { type: String, trim: true },
  horsePower: { type: Number, min: 0 },
  engineHours: { type: Number, min: 0 },
};

@Schema({ timestamps: true })
export class BoatEngine {
  @Prop({
    type: Types.ObjectId,
    ref: 'Post',
    required: true,
    unique: true,
    index: true,
  })
  postId: Types.ObjectId;

  @Prop({ type: [singleEngineDefinition], default: [] })
  engines: Array<{
    engineType?: string;
    fuelType?: string;
    engineMake?: string;
    engineModel?: string;
    horsePower?: number;
    engineHours?: number;
  }>;
}

export const BoatEngineSchema = SchemaFactory.createForClass(BoatEngine);
