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
import { MultipartJsonInterceptor } from '../../common/interceptors/multipart-json.interceptor';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enum/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // ─── CREATE POST ────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 200 * 1024 * 1024,
      },
    }),
    new MultipartJsonInterceptor([
      'boat_info',
      'boat_engine_info',
      'boat_additional_info',
    ]),
  )
  create(
    @Body() createPostDto: CreatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    return this.postsService.create(createPostDto, req.user, files);
  }

  // ─── FEED (SIMPLIFIED) ──────
  @Get('feed')
  getFeed(@Query() query: SearchPostsDto, @Request() req) {
    return this.postsService.getFeed(query, req.user);
  }

  // ─── LIST + SEARCH ────────
  @Get()
  findAll(@Query() query: SearchPostsDto, @Request() req) {
    return this.postsService.findAll(query, req.user);
  }

  // ─── GET ONE ──────────
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.postsService.findOne(id, req.user);
  }

  // ─── UPDATE POST ────────
  @Patch(':id')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 200 * 1024 * 1024,
      },
    }),
    new MultipartJsonInterceptor([
      'boat_info',
      'boat_engine_info',
      'boat_additional_info',
    ]),
  )
  update(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    return this.postsService.update(id, updatePostDto, req.user, files);
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
