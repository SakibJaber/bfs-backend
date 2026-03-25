import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import {
  NotificationEvents,
  NotificationEventPayload,
} from 'src/common/events/notification-events';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  private buildMessage(
    type: string,
    payload: NotificationEventPayload,
  ): string {
    switch (type) {
      case 'like':
        return 'Someone liked your post.';
      case 'comment':
        return 'Someone commented on your post.';
      case 'reply':
        return 'Someone replied to your comment.';
      case 'save':
        return 'Someone saved your post.';
      default:
        return '';
    }
  }

  private async create(
    type: 'like' | 'comment' | 'reply' | 'save',
    payload: NotificationEventPayload,
  ) {
    // Skip self-notifications
    if (payload.actorId === payload.userId) return;

    try {
      await this.notificationModel.create({
        userId: new Types.ObjectId(payload.userId),
        actorId: new Types.ObjectId(payload.actorId),
        type,
        ...(payload.postId && { postId: new Types.ObjectId(payload.postId) }),
        message: this.buildMessage(type, payload),
      });
    } catch (err) {
      this.logger.error(`Failed to create notification [${type}]`, err);
    }
  }

  @OnEvent(NotificationEvents.LIKED)
  handleLiked(payload: NotificationEventPayload) {
    return this.create('like', payload);
  }

  @OnEvent(NotificationEvents.COMMENTED)
  handleCommented(payload: NotificationEventPayload) {
    return this.create('comment', payload);
  }

  @OnEvent(NotificationEvents.REPLIED)
  handleReplied(payload: NotificationEventPayload) {
    return this.create('reply', payload);
  }

  @OnEvent(NotificationEvents.SAVED)
  handleSaved(payload: NotificationEventPayload) {
    return this.create('save', payload);
  }
}
