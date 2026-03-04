import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Post, PostSchema } from './schemas/post.schema';
import { PostMedia, PostMediaSchema } from './schemas/post-media.schema';
import { BoatInfo, BoatInfoSchema } from './schemas/boat-info.schema';
import { BoatEngine, BoatEngineSchema } from './schemas/boat-engine.schema';
import {
  BoatAdditional,
  BoatAdditionalSchema,
} from './schemas/boat-additional.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostMedia.name, schema: PostMediaSchema },
      { name: BoatInfo.name, schema: BoatInfoSchema },
      { name: BoatEngine.name, schema: BoatEngineSchema },
      { name: BoatAdditional.name, schema: BoatAdditionalSchema },
    ]),
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
