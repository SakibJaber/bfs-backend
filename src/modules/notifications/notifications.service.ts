import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { Profile, ProfileDocument } from '../users/schemas/profile.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(Profile.name)
    private readonly profileModel: Model<ProfileDocument>,
  ) {}

  async getMyNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const filter = { userId: new Types.ObjectId(userId) };
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'name')
        .lean()
        .exec(),
      this.notificationModel.countDocuments(filter),
    ]);

    // Enrich actor with avatarUrl from Profile
    const actorIds = [
      ...new Set(
        notifications
          .map((n) => (n.actorId as any)?._id?.toString())
          .filter(Boolean),
      ),
    ];

    const profiles = await this.profileModel
      .find({ userId: { $in: actorIds.map((id) => new Types.ObjectId(id)) } })
      .select('userId avatarUrl')
      .lean()
      .exec();

    const profileMap = profiles.reduce(
      (acc, p) => {
        acc[p.userId.toString()] = p;
        return acc;
      },
      {} as Record<string, any>,
    );

    const data = notifications.map((n) => {
      const actor = n.actorId as any;
      return {
        ...n,
        actorId: actor
          ? {
              ...actor,
              avatarUrl: profileMap[actor._id?.toString()]?.avatarUrl ?? null,
            }
          : null,
      };
    });

    return { data, total, page, limit };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
    return { count };
  }

  async markAsRead(id: string, userId: string): Promise<{ success: boolean }> {
    const result = await this.notificationModel.updateOne(
      {
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      },
      { $set: { isRead: true } },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Notification not found');
    }
    return { success: true };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true } },
    );
    return { updated: result.modifiedCount };
  }

  async deleteOne(id: string, userId: string): Promise<{ success: boolean }> {
    const result = await this.notificationModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Notification not found');
    }
    return { success: true };
  }

  @OnEvent('user.deleted')
  async handleUserDeleted(userId: string) {
    const userObjId = new Types.ObjectId(userId);
    await this.notificationModel.deleteMany({
      $or: [{ userId: userObjId }, { actorId: userObjId }],
    });
  }
}
