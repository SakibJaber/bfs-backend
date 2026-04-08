import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BoatAdditionalDocument = BoatAdditional & Document;

@Schema({ timestamps: true })
export class BoatAdditional {
  @Prop({
    type: Types.ObjectId,
    ref: 'Post',
    required: true,
    unique: true,
    index: true,
  })
  postId!: Types.ObjectId;

  @Prop({ trim: true })
  manufacturer!: string;

  @Prop({ trim: true })
  engineModel!: string;

  /** Bridge clearance in feet */
  @Prop({ min: 0 })
  bridgeClearance!: number;

  /** Fuel capacity in gallons */
  @Prop({ min: 0 })
  fuelCapacity!: number;

  /** Fresh water tank in gallons */
  @Prop({ min: 0 })
  freshWaterTank!: number;

  /** Cruise speed in knots */
  @Prop({ min: 0 })
  cruiseSpeed!: number;

  /** Length overall in feet */
  @Prop({ min: 0 })
  loa!: number;

  /** Max speed in knots */
  @Prop({ min: 0 })
  maxSpeed!: number;

  /** Beam width in feet */
  @Prop({ min: 0 })
  beam!: number;

  /** Number of cabins */
  @Prop({ min: 0 })
  cabin!: number;

  /** Draft in feet */
  @Prop({ min: 0 })
  draft!: number;

  @Prop({ trim: true })
  mechanicalEquipment!: string;

  @Prop({ trim: true })
  galleyEquipment!: string;

  @Prop({ trim: true })
  deckHullEquipment!: string;

  @Prop({ trim: true })
  navigationSystem!: string;

  @Prop({ trim: true })
  additionalEquipment!: string;
}

export const BoatAdditionalSchema =
  SchemaFactory.createForClass(BoatAdditional);
