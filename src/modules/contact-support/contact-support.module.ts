import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContactSupportService } from './contact-support.service';
import { ContactSupportController } from './contact-support.controller';
import {
  ContactSupport,
  ContactSupportSchema,
} from './schemas/contact-support.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContactSupport.name, schema: ContactSupportSchema },
    ]),
    MailModule,
  ],
  controllers: [ContactSupportController],
  providers: [ContactSupportService],
  exports: [ContactSupportService],
})
export class ContactSupportModule {}
