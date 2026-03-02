import { Module } from '@nestjs/common';
import { WebsocketService } from './websocket.service';
import { WebsocketController } from './websocket.controller';

@Module({
  controllers: [WebsocketController],
  providers: [WebsocketService],
})
export class WebsocketModule {}
