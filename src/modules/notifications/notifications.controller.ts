import {
  Controller,
  Get,
  Delete,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications?page=1&limit=20
   * Returns paginated notifications for the authenticated user
   */
  @Get()
  getMyNotifications(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getMyNotifications(
      req.user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * GET /notifications/unread-count
   * Returns the number of unread notifications
   */
  @Get('unread-count')
  getUnreadCount(@Request() req: any) {
    return this.notificationsService.getUnreadCount(req.user.userId);
  }

  /**
   * PATCH /notifications/read-all
   * Marks all notifications as read
   */
  @Patch('read-all')
  markAllRead(@Request() req: any) {
    return this.notificationsService.markAllRead(req.user.userId);
  }

  /**
   * PATCH /notifications/:id/read
   * Marks a single notification as read
   */
  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.markAsRead(id, req.user.userId);
  }

  /**
   * DELETE /notifications/:id
   * Deletes a notification
   */
  @Delete(':id')
  deleteOne(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.deleteOne(id, req.user.userId);
  }
}
