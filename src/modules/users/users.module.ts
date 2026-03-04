import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { Profile, ProfileSchema } from './schemas/profile.schema';
import { MailModule } from '../mail/mail.module';
import { UsersListener } from './users.listener';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Profile.name, schema: ProfileSchema },
    ]),
    MailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersListener],
  exports: [UsersService],
})
export class UsersModule {}
