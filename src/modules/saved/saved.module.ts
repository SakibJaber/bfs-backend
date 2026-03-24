import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SavedService } from './saved.service';
import { SavedController } from './saved.controller';
import { Saved, SavedSchema } from './schemas/saved.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Saved.name, schema: SavedSchema }]),
  ],
  controllers: [SavedController],
  providers: [SavedService],
  exports: [SavedService],
})
export class SavedModule {}
