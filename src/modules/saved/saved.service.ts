import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Saved, SavedDocument } from './schemas/saved.schema';
import { PostsService, AuthUser } from '../posts/posts.service';
import { SearchPostsDto } from '../posts/dto/search-posts.dto';

@Injectable()
export class SavedService {
  constructor(
    @InjectModel(Saved.name) private readonly savedModel: Model<SavedDocument>,
    private readonly postsService: PostsService,
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

  async findMySavedPosts(query: SearchPostsDto, user: AuthUser) {
    return this.postsService.getSavedPosts(query, user);
  }
}
