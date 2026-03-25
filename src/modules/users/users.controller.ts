import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UseGuards,
  Req,
  Query,
  Param,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enum/role.enum';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UPLOAD_FOLDERS } from 'src/common/constants/constants';
import { UploadsService } from 'src/modules/uploads/uploads.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploadService: UploadsService,
  ) {}

  // ─── Own Profile ─────────────────────────────────────────────────────────────

  /**
   * GET /users/me
   * Returns the authenticated user's full profile (user + linked profile document).
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req) {
    try {
      const data = await this.usersService.getProfile(req.user.userId);
      return {
        success: true,
        statusCode: 200,
        message: 'Profile fetched successfully',
        data,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'Failed to fetch profile' },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PATCH /users/update-profile
   * Updates name, bio, phone, socialLinks.
   * Optionally accepts a multipart `image` file which is uploaded to S3.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('update-profile')
  @UseInterceptors(FileInterceptor('image'))
  async updateProfile(
    @Req() req,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    try {
      if (image) {
        dto.avatarUrl = await this.uploadService.uploadImage(
          image.buffer,
          image.mimetype,
          image.originalname,
          UPLOAD_FOLDERS.USER_PROFILES,
        );
        dto.profileImage = dto.avatarUrl; // keep legacy field in sync
      }

      const data = await this.usersService.updateProfile(req.user.userId, dto);
      return {
        success: true,
        statusCode: 200,
        message: 'Profile updated successfully',
        data,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to update profile',
        },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PATCH /users/update-avatar
   * Dedicated avatar upload endpoint (multipart `avatar` field).
   */
  @UseGuards(JwtAuthGuard)
  @Patch('update-avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async updateAvatar(@Req() req, @UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
      }

      const avatarUrl = await this.uploadService.uploadImage(
        file.buffer,
        file.mimetype,
        file.originalname,
        UPLOAD_FOLDERS.USER_PROFILES,
      );

      const profile = await this.usersService.updateAvatar(
        req.user.userId,
        avatarUrl,
      );
      return {
        success: true,
        statusCode: 200,
        message: 'Avatar updated successfully',
        data: profile,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'Failed to update avatar' },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PATCH /users/change-password
   */
  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  async changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    try {
      await this.usersService.changePassword(req.user.userId, dto);
      return {
        success: true,
        statusCode: 200,
        message: 'Password changed successfully',
        data: null,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to change password',
        },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ─── Admin-only ───────────────────────────────────────────────────────────────

  /**
   * GET /users
   * Admin: paginated list of all users. Supports ?page, ?limit, ?role, ?search
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async findAll(@Query() query) {
    try {
      const { data, ...meta } = await this.usersService.findAll(query);
      return {
        success: true,
        statusCode: 200,
        message: 'Users fetched successfully',
        data,
        meta,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'Failed to fetch users' },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * GET /users/:id
   * Admin: get any user by ID.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const data = await this.usersService.getProfile(id);
      return {
        success: true,
        statusCode: 200,
        message: 'User fetched successfully',
        data,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'User not found' },
        error.status || HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * DELETE /users/:id
   * Admin: permanently deletes user + profile.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    try {
      await this.usersService.deleteUser(id);
      return {
        success: true,
        statusCode: 200,
        message: 'User deleted successfully',
        data: null,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'Failed to delete user' },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PATCH /users/:id/toggle-status
   * Admin: block / unblock a user.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/toggle-status')
  async toggleUserStatus(@Req() req, @Param('id') id: string) {
    try {
      const user = await this.usersService.toggleUserStatus(
        id,
        req.user.userId,
      );
      return {
        success: true,
        statusCode: 200,
        message: `User ${user!.status === 'BLOCKED' ? 'blocked' : 'unblocked'} successfully`,
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to toggle user status',
        },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PATCH /users/:id/role
   * Admin: change a user's role.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/role')
  async changeRole(@Param('id') id: string, @Body() dto: ChangeRoleDto) {
    try {
      const user = await this.usersService.changeRole(id, dto.role);
      return {
        success: true,
        statusCode: 200,
        message: 'User role updated',
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'Failed to update role' },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /users/admin
   * Super-admin: create a new admin account.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Post('admin')
  async createAdmin(@Body() dto: CreateAdminDto) {
    try {
      const admin = await this.usersService.createAdmin(dto);
      return {
        success: true,
        statusCode: 201,
        message: 'Admin created successfully',
        data: admin,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'Failed to create admin' },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ─── FCM Tokens ───────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Patch('fcm-token')
  async registerFcmToken(@Req() req, @Body() body: { token: string }) {
    await this.usersService.registerFcmToken(req.user.userId, body.token);
    return {
      success: true,
      statusCode: 200,
      message: 'FCM token registered',
      data: null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('fcm-token')
  async removeFcmToken(@Req() req, @Body() body: { token: string }) {
    await this.usersService.removeFcmToken(req.user.userId, body.token);
    return {
      success: true,
      statusCode: 200,
      message: 'FCM token removed',
      data: null,
    };
  }
}
