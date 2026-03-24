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
import { Like, LikeDocument } from '../likes/schemas/like.schema';
import { Comment, CommentDocument } from '../comments/schemas/comment.schema';
import { Saved, SavedDocument } from '../saved/schemas/saved.schema';
import { Profile, ProfileDocument } from '../users/schemas/profile.schema';

import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SearchPostsDto } from './dto/search-posts.dto';
import { UploadsService } from '../uploads/uploads.service';
import { Role } from '../../common/enum/role.enum';

export interface AuthUser {
  userId: string;
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
    @InjectModel(Like.name) private readonly likeModel: Model<LikeDocument>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    @InjectModel(Saved.name) private readonly savedModel: Model<SavedDocument>,
    @InjectModel(Profile.name)
    private readonly profileModel: Model<ProfileDocument>,
    private readonly uploadsService: UploadsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── CREATE ──────────
  async create(
    dto: CreatePostDto,
    user: AuthUser,
    files: Express.Multer.File[] = [],
  ): Promise<PostDocument> {
    const session = await this.postModel.db.startSession();
    session.startTransaction();

    let postId: Types.ObjectId;

    try {
      // 1. Create the base post
      const [post] = await this.postModel.create(
        [
          {
            userId: new Types.ObjectId(user.userId),
            title: dto.title,
            caption: dto.caption,
            location: dto.location,
            price: dto.price,
          },
        ],
        { session },
      );

      postId = post._id as Types.ObjectId;

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
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    // 5. Upload media if files are provided (Outside transaction)
    if (files && files.length > 0) {
      try {
        await this.uploadMedia(postId.toString(), files, user);
      } catch (mediaErr) {
        this.logger.error(
          `Post ${postId} created but media upload failed: ${mediaErr.message}`,
        );
        // We still return the post even if media fails, or you can throw if critical.
        // For now, let's let it pass but log the error.
      }
    }

    this.logger.log(`Post created: ${postId} by user ${user.userId}`);
    this.eventEmitter.emit('post.created', {
      postId: postId.toString(),
      userId: user.userId,
    });

    // Fetch the full post with all related data to return
    const fullPost = await this.findOne(postId.toString());
    return fullPost as any;
  }

  // ─── UPDATE ──────────

  async update(
    postId: string,
    dto: UpdatePostDto,
    user: AuthUser,
    files: Express.Multer.File[] = [],
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

    // Update/Add media if files are provided
    if (files && files.length > 0) {
      await this.uploadMedia(postId, files, user);
    }

    this.logger.log(`Post updated: ${postId}`);
    this.eventEmitter.emit('post.updated', { postId, userId: user.userId });

    return post;
  }

  // ─── SOFT DELETE ──────────

  async remove(postId: string, user: AuthUser): Promise<{ message: string }> {
    const post = await this.findActivePostOrThrow(postId);
    this.assertOwnerOrAdmin(post, user);

    post.status = 'deleted';
    await post.save();

    this.logger.log(`Post soft-deleted: ${postId}`);
    this.eventEmitter.emit('post.deleted', { postId, userId: user.userId });

    return { message: 'Post deleted successfully' };
  }

  // ─── GET ONE ──────────
  async findOne(
    postId: string,
    user?: AuthUser,
  ): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post ID');
    }

    const post = await this.postModel
      .findOne({ _id: postId, status: { $ne: 'deleted' } })
      .populate('userId', 'name')
      .lean()
      .exec();

    if (!post) throw new NotFoundException('Post not found');

    const [
      boatInfo,
      boatEngine,
      boatAdditional,
      media,
      likesCount,
      commentsCount,
      profile,
      isLiked,
      isSaved,
    ] = await Promise.all([
      this.boatInfoModel.findOne({ postId: post._id }).lean().exec(),
      this.boatEngineModel.findOne({ postId: post._id }).lean().exec(),
      this.boatAdditionalModel.findOne({ postId: post._id }).lean().exec(),
      this.postMediaModel
        .find({ postId: post._id })
        .sort({ order: 1 })
        .lean()
        .exec(),
      this.likeModel.countDocuments({ postId: post._id }).exec(),
      this.commentModel.countDocuments({ postId: post._id }).exec(),
      post.userId
        ? this.profileModel
            .findOne({ userId: (post.userId as any)._id })
            .lean()
            .exec()
        : Promise.resolve(null),
      user
        ? this.likeModel
            .exists({
              postId: post._id,
              userId: new Types.ObjectId(user.userId),
            })
            .then((res) => !!res)
        : Promise.resolve(false),
      user
        ? this.savedModel
            .exists({
              postId: post._id,
              userId: new Types.ObjectId(user.userId),
            })
            .then((res) => !!res)
        : Promise.resolve(false),
    ]);

    const displayTitle =
      `${boatInfo?.year ?? ''} ${boatAdditional?.manufacturer ?? ''} ${boatInfo?.model ?? ''}`.trim();

    const userObj = post.userId
      ? { ...(post.userId as any), avatarUrl: profile?.avatarUrl }
      : null;

    return {
      ...post,
      user: userObj,
      displayTitle,
      boatInfo,
      boatEngine,
      boatAdditional,
      media,
      likesCount,
      commentsCount,
      shareCount: 0, // Placeholder
      isLiked,
      isSaved,
    };
  }

  // ─── FEED (SIMPLIFIED) ──────────

  async getFeed(
    query: SearchPostsDto,
    user?: AuthUser,
  ): Promise<{
    data: unknown[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { page = 1, limit = 15 } = query;
    const skip = (page - 1) * limit;

    const postFilter: Record<string, any> = {
      status: { $ne: 'deleted' },
    };

    const [posts, total] = await Promise.all([
      this.postModel
        .find(postFilter)
        .select('_id userId location price createdAt title displayTitle')
        .populate('userId', 'name av')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.postModel.countDocuments(postFilter).exec(),
    ]);

    const postIds = posts.map((p) => p._id);

    // Fetch only necessary fields for displayTitle if not already computed or if we want to be sure
    // Actually, in the enhanced findAll I added displayTitle, but let's make sure it's computed here too
    // if it's not stored in the DB (it's not).

    const [
      boatInfos,
      boatAdditionals,
      mediaItems,
      likesCounts,
      commentsCounts,
      userLikes,
      userSaves,
      profiles,
    ] = await Promise.all([
      this.boatInfoModel
        .find({ postId: { $in: postIds } })
        .select('postId year model')
        .lean()
        .exec(),
      this.boatAdditionalModel
        .find({ postId: { $in: postIds } })
        .select('postId manufacturer')
        .lean()
        .exec(),
      this.postMediaModel
        .find({ postId: { $in: postIds } })
        .select('postId url type order')
        .sort({ order: 1 })
        .lean()
        .exec(),
      this.likeModel.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: '$postId', count: { $sum: 1 } } },
      ]),
      this.commentModel.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: '$postId', count: { $sum: 1 } } },
      ]),
      user
        ? this.likeModel
            .find({
              postId: { $in: postIds },
              userId: new Types.ObjectId(user.userId),
            })
            .select('postId')
            .lean()
            .exec()
        : Promise.resolve([]),
      user
        ? this.savedModel
            .find({
              postId: { $in: postIds },
              userId: new Types.ObjectId(user.userId),
            })
            .select('postId')
            .lean()
            .exec()
        : Promise.resolve([]),
      this.profileModel
        .find({
          userId: {
            $in: posts.map((p) => (p.userId as any)?._id).filter(Boolean),
          },
        })
        .select('userId avatarUrl')
        .lean()
        .exec(),
    ]);

    const boatInfoMap = boatInfos.reduce((acc, curr) => {
      acc[curr.postId.toString()] = curr;
      return acc;
    }, {});

    const boatAdditionalMap = boatAdditionals.reduce((acc, curr) => {
      acc[curr.postId.toString()] = curr;
      return acc;
    }, {});

    const mediaByPost = mediaItems.reduce<Record<string, any[]>>((acc, m) => {
      const key = (m.postId as Types.ObjectId).toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push({ url: m.url, type: m.type, order: m.order });
      return acc;
    }, {});

    const likesCountMap = likesCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    const commentsCountMap = commentsCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    const likedPostIds = new Set(userLikes.map((ul) => ul.postId.toString()));
    const savedPostIds = new Set(userSaves.map((us) => us.postId.toString()));
    const profileMap = profiles.reduce((acc, curr) => {
      acc[curr.userId.toString()] = curr;
      return acc;
    }, {});

    const data = posts.map((p) => {
      const idStr = p._id.toString();
      const bInfo = boatInfoMap[idStr];
      const bAdd = boatAdditionalMap[idStr];

      const displayTitle =
        `${bInfo?.year ?? ''} ${bAdd?.manufacturer ?? ''} ${bInfo?.model ?? ''}`.trim();

      const u = p.userId as any;
      const userObj = u
        ? { ...u, avatarUrl: profileMap[u._id?.toString()]?.avatarUrl }
        : null;

      return {
        _id: p._id,
        user: userObj,
        location: p.location,
        price: p.price,
        displayTitle,
        media: mediaByPost[idStr] ?? [],
        likesCount: likesCountMap[idStr] ?? 0,
        commentsCount: commentsCountMap[idStr] ?? 0,
        shareCount: 0, // Placeholder
        isLiked: likedPostIds.has(idStr),
        isSaved: savedPostIds.has(idStr),
        createdAt: (p as any).createdAt,
      };
    });

    const totalPages = Math.ceil(total / limit);
    return { data, meta: { total, page, limit, totalPages } };
  }

  // ─── SEARCH + PAGINATION ──────────

  async findAll(
    query: SearchPostsDto,
    user?: AuthUser,
  ): Promise<{
    data: unknown[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const {
      location,
      minPrice,
      maxPrice,
      boatType,
      minYear,
      maxYear,
      minLength,
      maxLength,
      category,
      manufacturer,
      engineMake,
      engineModel,
      fuelType,
      engineType,
      minHorsePower,
      maxHorsePower,
      page = 1,
      limit = 15,
    } = query;

    const skip = (page - 1) * limit;

    // ── Build filters for related models ──────────
    let filteredPostIds: Types.ObjectId[] | null = null;

    const intersectIds = (newIds: Types.ObjectId[]) => {
      if (filteredPostIds === null) {
        filteredPostIds = newIds;
      } else {
        const idStrings = new Set(newIds.map((id) => id.toString()));
        filteredPostIds = filteredPostIds.filter((id) =>
          idStrings.has(id.toString()),
        );
      }
    };

    // 1. BoatInfo Filters
    const boatInfoFilter: Record<string, any> = {};
    if (boatType) boatInfoFilter.boatType = { $regex: boatType, $options: 'i' };
    if (category) boatInfoFilter.category = { $regex: category, $options: 'i' };
    if (minYear !== undefined || maxYear !== undefined) {
      boatInfoFilter.year = {};
      if (minYear !== undefined) boatInfoFilter.year.$gte = minYear;
      if (maxYear !== undefined) boatInfoFilter.year.$lte = maxYear;
    }
    if (minLength !== undefined || maxLength !== undefined) {
      boatInfoFilter.length = {};
      if (minLength !== undefined) boatInfoFilter.length.$gte = minLength;
      if (maxLength !== undefined) boatInfoFilter.length.$lte = maxLength;
    }

    if (Object.keys(boatInfoFilter).length > 0) {
      const docs = await this.boatInfoModel
        .find(boatInfoFilter)
        .select('postId')
        .lean()
        .exec();
      intersectIds(docs.map((d) => d.postId as Types.ObjectId));
    }

    // 2. BoatEngine Filters
    const engineMatch: Record<string, any> = {};
    if (engineMake)
      engineMatch.engineMake = { $regex: engineMake, $options: 'i' };
    if (engineModel)
      engineMatch.engineModel = { $regex: engineModel, $options: 'i' };
    if (fuelType) engineMatch.fuelType = { $regex: fuelType, $options: 'i' };
    if (engineType)
      engineMatch.engineType = { $regex: engineType, $options: 'i' };
    if (minHorsePower !== undefined || maxHorsePower !== undefined) {
      engineMatch.horsePower = {};
      if (minHorsePower !== undefined)
        engineMatch.horsePower.$gte = minHorsePower;
      if (maxHorsePower !== undefined)
        engineMatch.horsePower.$lte = maxHorsePower;
    }

    if (Object.keys(engineMatch).length > 0) {
      const docs = await this.boatEngineModel
        .find({ engines: { $elemMatch: engineMatch } })
        .select('postId')
        .lean()
        .exec();
      intersectIds(docs.map((d) => d.postId as Types.ObjectId));
    }

    // 3. BoatAdditional Filters
    const boatAdditionalFilter: Record<string, any> = {};
    if (manufacturer) {
      boatAdditionalFilter.manufacturer = {
        $regex: manufacturer,
        $options: 'i',
      };
    }

    if (Object.keys(boatAdditionalFilter).length > 0) {
      const docs = await this.boatAdditionalModel
        .find(boatAdditionalFilter)
        .select('postId')
        .lean()
        .exec();
      intersectIds(docs.map((d) => d.postId as Types.ObjectId));
    }

    // If any related filter was applied and resulted in no matches
    if (filteredPostIds && (filteredPostIds as any).length === 0) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
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

    if (filteredPostIds !== null) {
      postFilter._id = { $in: filteredPostIds };
    }

    const [posts, total] = await Promise.all([
      this.postModel
        .find(postFilter)
        .populate('userId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.postModel.countDocuments(postFilter).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Attach media covers
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

    // Attach boat entities map
    const [boatInfos, boatEngines, boatAdditionals] = await Promise.all([
      this.boatInfoModel
        .find({ postId: { $in: postIds } })
        .lean()
        .exec(),
      this.boatEngineModel
        .find({ postId: { $in: postIds } })
        .lean()
        .exec(),
      this.boatAdditionalModel
        .find({ postId: { $in: postIds } })
        .lean()
        .exec(),
    ]);

    const byPostId = (items: any[]) =>
      items.reduce((acc, item) => {
        acc[item.postId.toString()] = item;
        return acc;
      }, {});

    const boatInfoMap = byPostId(boatInfos);
    const boatEngineMap = byPostId(boatEngines);
    const boatAdditionalMap = byPostId(boatAdditionals);

    const [likesCounts, commentsCounts, userLikes, userSaves, profiles] =
      await Promise.all([
        this.likeModel.aggregate([
          { $match: { postId: { $in: postIds } } },
          { $group: { _id: '$postId', count: { $sum: 1 } } },
        ]),
        this.commentModel.aggregate([
          { $match: { postId: { $in: postIds } } },
          { $group: { _id: '$postId', count: { $sum: 1 } } },
        ]),
        user
          ? this.likeModel
              .find({
                postId: { $in: postIds },
                userId: new Types.ObjectId(user.userId),
              })
              .select('postId')
              .lean()
              .exec()
          : Promise.resolve([]),
        user
          ? this.savedModel
              .find({
                postId: { $in: postIds },
                userId: new Types.ObjectId(user.userId),
              })
              .select('postId')
              .lean()
              .exec()
          : Promise.resolve([]),
        this.profileModel
          .find({
            userId: {
              $in: posts.map((p) => (p.userId as any)?._id).filter(Boolean),
            },
          })
          .select('userId avatarUrl')
          .lean()
          .exec(),
      ]);

    const likesCountMap = likesCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    const commentsCountMap = commentsCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    const likedPostIds = new Set(userLikes.map((ul) => ul.postId.toString()));
    const savedPostIds = new Set(userSaves.map((us) => us.postId.toString()));

    const profileMap = profiles.reduce((acc, curr) => {
      acc[curr.userId.toString()] = curr;
      return acc;
    }, {});

    const data = posts.map((p) => {
      const idStr = (p._id as Types.ObjectId).toString();
      const bInfo = boatInfoMap[idStr] ?? null;
      const bAdd = boatAdditionalMap[idStr] ?? null;

      const displayTitle =
        `${bInfo?.year ?? ''} ${bAdd?.manufacturer ?? ''} ${bInfo?.model ?? ''}`.trim();

      const u = p.userId as any;
      const userObj = u
        ? { ...u, avatarUrl: profileMap[u._id?.toString()]?.avatarUrl }
        : null;

      return {
        ...p,
        user: userObj,
        displayTitle,
        boatInfo: bInfo,
        boatEngine: boatEngineMap[idStr] ?? null,
        boatAdditional: bAdd,
        media: mediaByPost[idStr] ?? [],
        likesCount: likesCountMap[idStr] ?? 0,
        commentsCount: commentsCountMap[idStr] ?? 0,
        shareCount: 0, // Placeholder
        isLiked: likedPostIds.has(idStr),
        isSaved: savedPostIds.has(idStr),
      };
    });

    return { data, meta: { total, page, limit, totalPages } };
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
      (post.userId as Types.ObjectId).toString() === user.userId.toString();

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'You do not have permission to modify this post',
      );
    }
  }
}
