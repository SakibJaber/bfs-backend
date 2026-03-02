import { Test, TestingModule } from '@nestjs/testing';
import { WebsocketController } from './websocket.controller';
import { WebsocketService } from './websocket.service';

describe('WebsocketController', () => {
  let controller: WebsocketController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebsocketController],
      providers: [WebsocketService],
    }).compile();

    controller = module.get<WebsocketController>(WebsocketController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
