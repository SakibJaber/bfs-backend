import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Query,
  Param,
} from '@nestjs/common';
import { SavedService } from './saved.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SearchPostsDto } from '../posts/dto/search-posts.dto';

@Controller('saved')
export class SavedController {
  constructor(private readonly savedService: SavedService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':postId')
  toggle(@Param('postId') postId: string, @Request() req) {
    return this.savedService.toggle(postId, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findMySavedPosts(@Query() query: SearchPostsDto, @Request() req) {
    return this.savedService.findMySavedPosts(query, req.user);
  }
}
