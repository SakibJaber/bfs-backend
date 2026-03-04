import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SearchPostsDto } from './dto/search-posts.dto';

import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enum/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // ─── CREATE POST ────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPostDto: CreatePostDto, @Request() req) {
    return this.postsService.create(createPostDto, req.user);
  }

  // ─── LIST + SEARCH ────────
  @Get()
  findAll(@Query() query: SearchPostsDto) {
    return this.postsService.findAll(query);
  }

  // ─── GET ONE ──────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  // ─── UPDATE POST ────────
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @Request() req,
  ) {
    return this.postsService.update(id, updatePostDto, req.user);
  }

  // ─── DELETE POST ────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @Request() req) {
    return this.postsService.remove(id, req.user);
  }

  // ─── UPLOAD MEDIA ────────
  @Post(':id/media')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 200 * 1024 * 1024, // 200 MB max per file
      },
    }),
  )
  uploadMedia(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    return this.postsService.uploadMedia(id, files, req.user);
  }

  // ─── DELETE MEDIA ────────
  @Delete(':id/media/:mediaId')
  @HttpCode(HttpStatus.OK)
  deleteMedia(
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
    @Request() req,
  ) {
    return this.postsService.deleteMedia(id, mediaId, req.user);
  }

  // ─── ADMIN: HARD DELETE (optional) ────────
  @Delete(':id/admin')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  adminRemove(@Param('id') id: string, @Request() req) {
    // Admins also go through the same soft-delete path;
    // extend here if you need a hard delete.
    return this.postsService.remove(id, req.user);
  }
}
