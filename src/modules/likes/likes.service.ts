import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Like, LikeDocument } from './schemas/like.schema';

@Injectable()
export class LikesService {
  constructor(
    @InjectModel(Like.name) private readonly likeModel: Model<LikeDocument>,
  ) {}

  async toggle(postId: string, user: { userId: string }) {
    const filter = {
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(user.userId),
    };

    const existing = await this.likeModel.findOne(filter);

    if (existing) {
      await this.likeModel.deleteOne(filter);
      return { liked: false };
    } else {
      await this.likeModel.create(filter);
      return { liked: true };
    }
  }
}
