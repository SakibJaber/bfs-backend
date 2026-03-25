import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Like, LikeDocument } from './schemas/like.schema';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import {
  NotificationEvents,
  NotificationEventPayload,
} from 'src/common/events/notification-events';

@Injectable()
export class LikesService {
  private readonly logger = new Logger(LikesService.name);

  constructor(
    @InjectModel(Like.name) private readonly likeModel: Model<LikeDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async toggle(postId: string, user: { userId: string }) {
    const postObjectId = new Types.ObjectId(postId);
    const userObjectId = new Types.ObjectId(user.userId);

    const filter = { postId: postObjectId, userId: userObjectId };
    const existing = await this.likeModel.findOne(filter);

    if (existing) {
      await this.likeModel.deleteOne(filter);
      await this.postModel.updateOne(
        { _id: postObjectId },
        { $inc: { likesCount: -1 } },
      );
      return { liked: false };
    } else {
      const [post] = await Promise.all([
        this.postModel.findById(postObjectId).select('userId').lean().exec(),
        this.likeModel.create(filter),
        this.postModel.updateOne(
          { _id: postObjectId },
          { $inc: { likesCount: 1 } },
        ),
      ]);

      // Emit notification event (skip if user likes their own post)
      if (post && post.userId?.toString() !== user.userId) {
        const payload: NotificationEventPayload = {
          userId: post.userId.toString(),
          actorId: user.userId,
          postId,
        };
        this.eventEmitter.emit(NotificationEvents.LIKED, payload);
      }

      return { liked: true };
    }
  }
}
