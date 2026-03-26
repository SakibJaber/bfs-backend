import { Module } from '@nestjs/common';
import { AdminModule } from 'src/modules/admin/admin.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ChatModule } from 'src/modules/chat/chat.module';
import { CommentsModule } from 'src/modules/comments/comments.module';
import { ContactSupportModule } from 'src/modules/contact-support/contact-support.module';
import { LegalContentModule } from 'src/modules/legal-content/legal-content.module';
import { LikesModule } from 'src/modules/likes/likes.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { PostsModule } from 'src/modules/posts/posts.module';
import { SavedModule } from 'src/modules/saved/saved.module';
import { ReportsModule } from 'src/modules/reports/reports.module';
import { SearchModule } from 'src/modules/search/search.module';
import { UsersModule } from 'src/modules/users/users.module';
import { WebsocketModule } from 'src/modules/websocket/websocket.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    PostsModule,
    LikesModule,
    SavedModule,
    CommentsModule,
    ChatModule,
    NotificationsModule,
    SearchModule,
    AdminModule,
    WebsocketModule,
    ContactSupportModule,
    LegalContentModule,
    ReportsModule,
  ],
})
export class DomainModule {}
