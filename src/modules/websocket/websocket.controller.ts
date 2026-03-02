import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { WebsocketService } from './websocket.service';
import { CreateWebsocketDto } from './dto/create-websocket.dto';
import { UpdateWebsocketDto } from './dto/update-websocket.dto';

@Controller('websocket')
export class WebsocketController {
  constructor(private readonly websocketService: WebsocketService) {}

  @Post()
  create(@Body() createWebsocketDto: CreateWebsocketDto) {
    return this.websocketService.create(createWebsocketDto);
  }

  @Get()
  findAll() {
    return this.websocketService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.websocketService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateWebsocketDto: UpdateWebsocketDto) {
    return this.websocketService.update(+id, updateWebsocketDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.websocketService.remove(+id);
  }
}
