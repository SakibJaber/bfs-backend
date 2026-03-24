import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Profile, ProfileDocument } from '../users/schemas/profile.schema';

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
      ...(populated.toObject ? populated.toObject() : populated),
      userId: userObj,
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
          // If parent not found (shouldn't happen with valid data), treat as root
          roots.push(commentWithReplies);
        }
      } else {
        roots.push(commentWithReplies);
      }
    });

    return roots;
  }

  async remove(id: string, user: AuthUser) {
    // Basic implementation, you might want to check ownership
    return this.commentModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(user.userId),
    });
  }
}
