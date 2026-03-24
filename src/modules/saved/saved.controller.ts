import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { SavedService } from './saved.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('saved')
export class SavedController {
  constructor(private readonly savedService: SavedService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  toggle(@Body('postId') postId: string, @Request() req) {
    return this.savedService.toggle(postId, req.user);
  }
}
