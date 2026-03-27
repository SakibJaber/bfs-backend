import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UploadsService } from '../uploads/uploads.service';
import { UPLOAD_FOLDERS } from 'src/common/constants/constants';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    try {
      const imageUrl = await this.uploadsService.uploadImage(
        file.buffer,
        file.mimetype,
        file.originalname,
        UPLOAD_FOLDERS.CHAT,
      );
      return {
        success: true,
        statusCode: 201,
        message: 'Image uploaded successfully',
        data: { url: imageUrl },
      };
    } catch (error) {
      return {
        success: false,
        statusCode: error.status || 400,
        message: error.message || 'Failed to upload image',
        data: null,
      };
    }
  }

  @Get('conversations')
  async getConversations(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Req() req,
  ) {
    try {
      const result = await this.chatService.getConversations(
        req.user.userId,
        req.user.role,
        Number(page),
        Number(limit),
      );
      return {
        success: true,
        statusCode: 200,
        message: 'Conversations fetched successfully',
        data: result.data,
        meta: result.meta,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: error.status || 400,
        message: error.message || 'Failed to fetch conversations',
        data: null,
      };
    }
  }

  @Get('messages/:conversationId')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Req() req,
  ) {
    try {
      const result = await this.chatService.getMessages(
        conversationId,
        req.user.userId,
        req.user.role,
        Number(page),
        Number(limit),
      );
      return {
        success: true,
        statusCode: 200,
        message: 'Messages fetched successfully',
        data: result.data,
        meta: result.meta,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: error.status || 400,
        message: error.message || 'Failed to fetch messages',
        data: null,
      };
    }
  }

  @Post('read/:conversationId')
  async markAsRead(
    @Param('conversationId') conversationId: string,
    @Req() req,
  ) {
    try {
      await this.chatService.markAsRead(
        conversationId,
        req.user.userId,
        req.user.role,
      );
      return {
        success: true,
        statusCode: 200,
        message: 'Messages marked as read',
        data: null,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: error.status || 400,
        message: error.message || 'Failed to mark messages as read',
        data: null,
      };
    }
  }
}
