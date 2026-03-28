import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Saved, SavedDocument } from './schemas/saved.schema';
import { PostsService, AuthUser } from '../posts/posts.service';
import { SearchPostsDto } from '../posts/dto/search-posts.dto';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import {
  NotificationEvents,
  NotificationEventPayload,
} from 'src/common/events/notification-events';

@Injectable()
export class SavedService {
  constructor(
    @InjectModel(Saved.name) private readonly savedModel: Model<SavedDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly postsService: PostsService,
    private readonly eventEmitter: EventEmitter2,
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
      const [post] = await Promise.all([
        this.postModel
          .findById(new Types.ObjectId(postId))
          .select('userId')
          .lean()
          .exec(),
        this.savedModel.create(filter),
      ]);

      // Emit notification event (skip if user saves their own post)
      if (post && post.userId?.toString() !== user.userId) {
        const payload: NotificationEventPayload = {
          userId: post.userId.toString(),
          actorId: user.userId,
          postId,
        };
        this.eventEmitter.emit(NotificationEvents.SAVED, payload);
      }

      return { saved: true };
    }
  }

  async findMySavedPosts(query: SearchPostsDto, user: AuthUser) {
    return this.postsService.getSavedPosts(query, user);
  }

  @OnEvent('user.deleted')
  async handleUserDeleted(userId: string) {
    await this.savedModel.deleteMany({ userId: new Types.ObjectId(userId) });
  }
}
