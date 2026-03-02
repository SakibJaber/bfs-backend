import { Module } from '@nestjs/common';
import { AdminModule } from 'src/modules/admin/admin.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ChatModule } from 'src/modules/chat/chat.module';
import { CommentsModule } from 'src/modules/comments/comments.module';
import { FollowsModule } from 'src/modules/follows/follows.module';
import { LikesModule } from 'src/modules/likes/likes.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { PostsModule } from 'src/modules/posts/posts.module';
import { SavedModule } from 'src/modules/saved/saved.module';
import { SearchModule } from 'src/modules/search/search.module';
import { UsersModule } from 'src/modules/users/users.module';
import { WebsocketModule } from 'src/modules/websocket/websocket.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    FollowsModule,
    PostsModule,
    LikesModule,
    SavedModule,
    CommentsModule,
    ChatModule,
    NotificationsModule,
    SearchModule,
    AdminModule,
    WebsocketModule,
  ],
})
export class DomainModule {}
