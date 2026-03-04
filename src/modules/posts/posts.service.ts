import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Post, PostDocument } from './schemas/post.schema';
import { PostMedia, PostMediaDocument } from './schemas/post-media.schema';
import { BoatInfo, BoatInfoDocument } from './schemas/boat-info.schema';
import { BoatEngine, BoatEngineDocument } from './schemas/boat-engine.schema';
import {
  BoatAdditional,
  BoatAdditionalDocument,
} from './schemas/boat-additional.schema';

import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SearchPostsDto } from './dto/search-posts.dto';
import { UploadsService } from '../uploads/uploads.service';
import { Role } from 'src/common/enum/role.enum';

export interface AuthUser {
  _id: string;
  role: Role;
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(PostMedia.name)
    private readonly postMediaModel: Model<PostMediaDocument>,
    @InjectModel(BoatInfo.name)
    private readonly boatInfoModel: Model<BoatInfoDocument>,
    @InjectModel(BoatEngine.name)
    private readonly boatEngineModel: Model<BoatEngineDocument>,
    @InjectModel(BoatAdditional.name)
    private readonly boatAdditionalModel: Model<BoatAdditionalDocument>,
    private readonly uploadsService: UploadsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── CREATE ──────────
  async create(dto: CreatePostDto, user: AuthUser): Promise<PostDocument> {
    const session = await this.postModel.db.startSession();
    session.startTransaction();

    try {
      // 1. Create the base post
      const [post] = await this.postModel.create(
        [
          {
            userId: new Types.ObjectId(user._id),
            caption: dto.caption,
            location: dto.location,
            price: dto.price,
          },
        ],
        { session },
      );

      const postId = post._id as Types.ObjectId;

      // 2. Create boat-info if provided
      if (dto.boat_info) {
        const [boatInfo] = await this.boatInfoModel.create(
          [{ postId, ...dto.boat_info }],
          { session },
        );
        (post as any).boatInfoId = boatInfo._id as Types.ObjectId;
      }

      // 3. Create boat-engine if provided
      if (dto.boat_engine_info) {
        const [boatEngine] = await this.boatEngineModel.create(
          [{ postId, ...dto.boat_engine_info }],
          { session },
        );
        (post as any).boatEngineId = boatEngine._id as Types.ObjectId;
      }

      // 4. Create boat-additional if provided
      if (dto.boat_additional_info) {
        const [boatAdditional] = await this.boatAdditionalModel.create(
          [{ postId, ...dto.boat_additional_info }],
          { session },
        );
        (post as any).boatAdditionalId = boatAdditional._id as Types.ObjectId;
      }

      await post.save({ session });
      await session.commitTransaction();

      this.logger.log(`Post created: ${postId} by user ${user._id}`);
      this.eventEmitter.emit('post.created', {
        postId: postId.toString(),
        userId: user._id,
      });

      return post;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // ─── UPDATE ──────────

  async update(
    postId: string,
    dto: UpdatePostDto,
    user: AuthUser,
  ): Promise<PostDocument> {
    const post = await this.findActivePostOrThrow(postId);
    this.assertOwnerOrAdmin(post, user);

    // Update post root fields
    const { boat_info, boat_engine_info, boat_additional_info, ...rootFields } =
      dto;

    if (Object.keys(rootFields).length > 0) {
      Object.assign(post, rootFields);
      await post.save();
    }

    // Update boat info
    if (boat_info) {
      await this.boatInfoModel.findOneAndUpdate(
        { postId: post._id },
        { $set: boat_info },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
    }

    // Update boat engine
    if (boat_engine_info) {
      await this.boatEngineModel.findOneAndUpdate(
        { postId: post._id },
        { $set: boat_engine_info },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
    }

    // Update boat additional
    if (boat_additional_info) {
      await this.boatAdditionalModel.findOneAndUpdate(
        { postId: post._id },
        { $set: boat_additional_info },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
    }

    this.logger.log(`Post updated: ${postId}`);
    this.eventEmitter.emit('post.updated', { postId, userId: user._id });

    return post;
  }

  // ─── SOFT DELETE ──────────

  async remove(postId: string, user: AuthUser): Promise<{ message: string }> {
    const post = await this.findActivePostOrThrow(postId);
    this.assertOwnerOrAdmin(post, user);

    post.status = 'deleted';
    await post.save();

    this.logger.log(`Post soft-deleted: ${postId}`);
    this.eventEmitter.emit('post.deleted', { postId, userId: user._id });

    return { message: 'Post deleted successfully' };
  }

  // ─── GET ONE ──────────

  async findOne(postId: string): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID');
    }

    const post = await this.postModel
      .findOne({ _id: postId, status: { $ne: 'deleted' } })
      .populate('userId', 'firstName lastName avatar')
      .lean()
      .exec();

    if (!post) throw new NotFoundException('Post not found');

    const [boatInfo, boatEngine, boatAdditional, media] = await Promise.all([
      this.boatInfoModel.findOne({ postId: post._id }).lean().exec(),
      this.boatEngineModel.findOne({ postId: post._id }).lean().exec(),
      this.boatAdditionalModel.findOne({ postId: post._id }).lean().exec(),
      this.postMediaModel
        .find({ postId: post._id })
        .sort({ order: 1 })
        .lean()
        .exec(),
    ]);

    return { ...post, boatInfo, boatEngine, boatAdditional, media };
  }

  // ─── SEARCH + PAGINATION ──────────

  async findAll(
    query: SearchPostsDto,
  ): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const {
      location,
      minPrice,
      maxPrice,
      boatType,
      minYear,
      maxYear,
      minLength,
      maxLength,
      page = 1,
      limit = 15,
    } = query;

    const skip = (page - 1) * limit;

    // ── Build BoatInfo filter if any boat fields are provided ──────────
    const hasBoatFilter =
      boatType || minYear || maxYear || minLength || maxLength;
    let boatInfoPostIds: Types.ObjectId[] | null = null;

    if (hasBoatFilter) {
      const boatFilter: Record<string, any> = {};
      if (boatType) boatFilter.boatType = { $regex: boatType, $options: 'i' };
      if (minYear !== undefined || maxYear !== undefined) {
        boatFilter.year = {};
        if (minYear !== undefined) boatFilter.year.$gte = minYear;
        if (maxYear !== undefined) boatFilter.year.$lte = maxYear;
      }
      if (minLength !== undefined || maxLength !== undefined) {
        boatFilter.length = {};
        if (minLength !== undefined) boatFilter.length.$gte = minLength;
        if (maxLength !== undefined) boatFilter.length.$lte = maxLength;
      }

      const matchingBoatInfoDocs = await this.boatInfoModel
        .find(boatFilter)
        .select('postId')
        .lean()
        .exec();

      boatInfoPostIds = matchingBoatInfoDocs.map(
        (d) => d.postId as Types.ObjectId,
      );

      // No matching boat info → return empty result immediately
      if (boatInfoPostIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }
    }

    // ── Build Post filter ──────────
    const postFilter: Record<string, any> = {
      status: { $ne: 'deleted' },
    };

    if (location) {
      postFilter.location = { $regex: location, $options: 'i' };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      postFilter.price = {};
      if (minPrice !== undefined) postFilter.price.$gte = minPrice;
      if (maxPrice !== undefined) postFilter.price.$lte = maxPrice;
    }

    if (boatInfoPostIds !== null) {
      postFilter._id = { $in: boatInfoPostIds };
    }

    const [posts, total] = await Promise.all([
      this.postModel
        .find(postFilter)
        .populate('userId', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.postModel.countDocuments(postFilter).exec(),
    ]);

    // Attach media covers (first ordered item per post)
    const postIds = posts.map((p) => p._id);
    const mediaItems = await this.postMediaModel
      .find({ postId: { $in: postIds } })
      .sort({ order: 1 })
      .lean()
      .exec();

    const mediaByPost = mediaItems.reduce<Record<string, unknown[]>>(
      (acc, m) => {
        const key = (m.postId as Types.ObjectId).toString();
        if (!acc[key]) acc[key] = [];
        acc[key].push(m);
        return acc;
      },
      {},
    );

    const data = posts.map((p) => ({
      ...p,
      media: mediaByPost[(p._id as Types.ObjectId).toString()] ?? [],
    }));

    return { data, total, page, limit };
  }

  // ─── MEDIA: UPLOAD ──────────

  async uploadMedia(
    postId: string,
    files: Express.Multer.File[],
    user: AuthUser,
  ): Promise<PostMediaDocument[]> {
    const post = await this.findActivePostOrThrow(postId);
    this.assertOwnerOrAdmin(post, user);

    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Count existing media to set order offset
    const existingCount = await this.postMediaModel.countDocuments({
      postId: post._id,
    });

    const createdMedia: PostMediaDocument[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const mime = file.mimetype;
      const isVideo = mime.startsWith('video/');
      const isImage = mime.startsWith('image/');

      if (!isImage && !isVideo) {
        throw new BadRequestException(
          `File "${file.originalname}" has unsupported MIME type: ${mime}`,
        );
      }

      let url: string;
      let thumbnailUrl: string | null = null;
      let durationSeconds = 0;

      if (isImage) {
        url = await this.uploadsService.uploadImage(
          file.buffer,
          mime,
          file.originalname,
          'posts/images',
        );
      } else {
        const result = await this.uploadsService.uploadVideo(
          file.buffer,
          mime,
          file.originalname,
          'posts/videos',
        );
        url = result.url;
        thumbnailUrl = result.thumbnailUrl;
        durationSeconds = result.durationSeconds;
      }

      const media = await this.postMediaModel.create({
        postId: post._id,
        type: isImage ? 'image' : 'video',
        url,
        thumbnailUrl: thumbnailUrl ?? undefined,
        order: existingCount + i,
        durationSeconds,
      });

      createdMedia.push(media);
    }

    return createdMedia;
  }

  // ─── MEDIA: DELETE ──────────

  async deleteMedia(
    postId: string,
    mediaId: string,
    user: AuthUser,
  ): Promise<{ message: string }> {
    const post = await this.findActivePostOrThrow(postId);
    this.assertOwnerOrAdmin(post, user);

    if (!Types.ObjectId.isValid(mediaId)) {
      throw new BadRequestException('Invalid media ID');
    }

    const media = await this.postMediaModel.findOne({
      _id: mediaId,
      postId: post._id,
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    // Delete from S3
    await this.uploadsService.deleteByUrl(media.url);
    if (media.thumbnailUrl) {
      await this.uploadsService.deleteByUrl(media.thumbnailUrl);
    }

    await media.deleteOne();

    return { message: 'Media deleted successfully' };
  }

  // ─── Private helpers ──────────

  private async findActivePostOrThrow(postId: string): Promise<PostDocument> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID');
    }

    const post = await this.postModel.findOne({
      _id: postId,
      status: { $ne: 'deleted' },
    });

    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  private assertOwnerOrAdmin(post: PostDocument, user: AuthUser): void {
    const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
    const isOwner =
      (post.userId as Types.ObjectId).toString() === user._id.toString();

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'You do not have permission to modify this post',
      );
    }
  }
}
