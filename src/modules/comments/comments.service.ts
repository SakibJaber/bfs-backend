import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { CreateCommentDto } from './dto/create-comment.dto';

export interface AuthUser {
  userId: string;
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
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
    return saved.populate('userId', 'name');
  }

  async findByPost(postId: string): Promise<any[]> {
    const comments = await this.commentModel
      .find({ postId: new Types.ObjectId(postId) })
      .populate('userId', 'name')
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    // Grouping comments into threads
    const commentMap = new Map();
    const roots: any[] = [];

    comments.forEach((comment) => {
      commentMap.set(comment._id.toString(), { ...comment, replies: [] });
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
