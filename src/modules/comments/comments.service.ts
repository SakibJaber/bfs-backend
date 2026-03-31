import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Profile, ProfileDocument } from '../users/schemas/profile.schema';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import {
  NotificationEvents,
  NotificationEventPayload,
} from 'src/common/events/notification-events';

export interface AuthUser {
  userId: string;
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    @InjectModel(Profile.name)
    private readonly profileModel: Model<ProfileDocument>,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    dto: CreateCommentDto,
    user: AuthUser,
  ): Promise<CommentDocument> {
    const parentId =
      dto.parentId && Types.ObjectId.isValid(dto.parentId)
        ? new Types.ObjectId(dto.parentId)
        : null;

    const created = new this.commentModel({
      postId: new Types.ObjectId(dto.postId),
      userId: new Types.ObjectId(user.userId),
      text: dto.text,
      parentId,
    });

    const saved = await created.save();

    await this.postModel.updateOne(
      { _id: new Types.ObjectId(dto.postId) },
      { $inc: { commentsCount: 1 } },
    );

    // ─── Emit notification ────────────────────────────────────────────
    if (parentId) {
      // Reply → notify the parent comment's author
      const parentComment = await this.commentModel
        .findById(parentId)
        .select('userId')
        .lean()
        .exec();

      if (parentComment && parentComment.userId.toString() !== user.userId) {
        const payload: NotificationEventPayload = {
          userId: parentComment.userId.toString(),
          actorId: user.userId,
          postId: dto.postId,
          commentId: saved._id.toString(),
        };
        this.eventEmitter.emit(NotificationEvents.REPLIED, payload);
      }
    } else {
      // Top-level comment → notify the post owner
      const post = await this.postModel
        .findById(new Types.ObjectId(dto.postId))
        .select('userId')
        .lean()
        .exec();

      if (post && post.userId.toString() !== user.userId) {
        const payload: NotificationEventPayload = {
          userId: post.userId.toString(),
          actorId: user.userId,
          postId: dto.postId,
          commentId: saved._id.toString(),
        };
        this.eventEmitter.emit(NotificationEvents.COMMENTED, payload);
      }
    }
    // ─────────────────────────────────────────────────────────────────

    const populated = await saved.populate('userId', 'name');

    // Attach profile avatar
    const profile = await this.profileModel
      .findOne({ userId: (populated.userId as any)._id })
      .select('avatarUrl')
      .lean()
      .exec();

    const userObj = {
      ...((populated.userId as any).toObject?.() || (populated.userId as any)),
      avatarUrl: profile?.avatarUrl,
    };

    return {
      data: {
        ...(populated.toObject ? populated.toObject() : populated),
        userId: userObj,
      },
      message: parentId ? 'Replied successfully' : 'Commented successfully',
    } as any;
  }

  async findByPost(postId: string): Promise<any[]> {
    const comments = await this.commentModel
      .find({ postId: new Types.ObjectId(postId) })
      .populate('userId', 'name')
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    const userIds = [
      ...new Set(
        comments
          .map(
            (c) =>
              (c.userId as any)?._id?.toString() ||
              (c.userId as any)?.id?.toString(),
          )
          .filter(Boolean),
      ),
    ];
    const profiles = await this.profileModel
      .find({ userId: { $in: userIds.map((id) => new Types.ObjectId(id)) } })
      .select('userId avatarUrl')
      .lean()
      .exec();

    const profileMap = profiles.reduce((acc, p) => {
      acc[p.userId.toString()] = p;
      return acc;
    }, {});

    // Grouping comments into threads
    const commentMap = new Map();
    const roots: any[] = [];

    comments.forEach((comment) => {
      const u = comment.userId as any;
      const userObj = u
        ? { ...u, avatarUrl: profileMap[u._id?.toString() || u.id]?.avatarUrl }
        : null;

      commentMap.set(comment._id.toString(), {
        ...comment,
        userId: userObj,
        replies: [],
      });
    });

    comments.forEach((comment) => {
      const commentWithReplies = commentMap.get(comment._id.toString());
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId.toString());
        if (parent) {
          parent.replies.push(commentWithReplies);
        } else {
          roots.push(commentWithReplies);
        }
      } else {
        roots.push(commentWithReplies);
      }
    });

    return roots;
  }

  async remove(id: string, user: AuthUser) {
    const comment = await this.commentModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(user.userId),
    });

    if (comment) {
      const res = await this.commentModel.deleteOne({ _id: comment._id });
      await this.postModel.updateOne(
        { _id: comment.postId },
        { $inc: { commentsCount: -1 } },
      );
      return { message: 'Comment deleted successfully' };
    }

    return { message: 'Comment not found or already deleted' };
  }

  @OnEvent('user.deleted')
  async handleUserDeleted(userId: string) {
    await this.commentModel.deleteMany({ userId: new Types.ObjectId(userId) });
  }
}
