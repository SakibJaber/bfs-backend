import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  toggle(@Body('postId') postId: string, @Request() req) {
    return this.likesService.toggle(postId, req.user);
  }
}
