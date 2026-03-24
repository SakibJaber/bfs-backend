import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Saved, SavedDocument } from './schemas/saved.schema';

@Injectable()
export class SavedService {
  constructor(
    @InjectModel(Saved.name) private readonly savedModel: Model<SavedDocument>,
  ) {}

  async toggle(postId: string, user: { userId: string }) {
    const filter = {
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(user.userId),
    };

    const existing = await this.savedModel.findOne(filter);

    if (existing) {
      await this.savedModel.deleteOne(filter);
      return { saved: false };
    } else {
      await this.savedModel.create(filter);
      return { saved: true };
    }
  }
}
