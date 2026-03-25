import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SavedService } from './saved.service';
import { SavedController } from './saved.controller';
import { Saved, SavedSchema } from './schemas/saved.schema';
import { Post, PostSchema } from '../posts/schemas/post.schema';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Saved.name, schema: SavedSchema },
      { name: Post.name, schema: PostSchema },
    ]),
    PostsModule,
  ],
  controllers: [SavedController],
  providers: [SavedService],
  exports: [SavedService],
})
export class SavedModule {}
