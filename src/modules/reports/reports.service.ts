import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument } from './schemas/report.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { UploadsService } from '../uploads/uploads.service';
import { PostsService } from '../posts/posts.service';
import { UsersService } from '../users/users.service';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly uploadsService: UploadsService,
    @Inject(forwardRef(() => PostsService))
    private readonly postsService: PostsService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  async findOne(id: string): Promise<any> {
    const report = await this.reportModel
      .findById(id)
      .populate('reporterId', 'name email')
      .populate('resolvedBy', 'name email')
      .lean()
      .exec();

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    let targetDetails: any = null;

    if (report.targetType === 'post') {
      try {
        targetDetails = await this.postsService.findOne(
          report.targetId.toString(),
        );
      } catch (err) {
        targetDetails = { error: 'Post not found or deleted' };
      }
    } else if (report.targetType === 'user') {
      try {
        targetDetails = await this.usersService.getProfile(
          report.targetId.toString(),
        );
      } catch (err) {
        targetDetails = { error: 'User not found' };
      }
    }

    return {
      ...report,
      targetDetails,
    };
  }

  async create(
    createReportDto: CreateReportDto,
    user: any,
    file?: Express.Multer.File,
  ): Promise<Report> {
    let imageUrl = createReportDto.image;

    if (file) {
      imageUrl = await this.uploadsService.uploadImage(
        file.buffer,
        file.mimetype,
        file.originalname,
        'reports',
      );
    }

    const newReport = new this.reportModel({
      ...createReportDto,
      image: imageUrl,
      reporterId: new Types.ObjectId(user.userId),
    });
    const saved = await newReport.save();
    return {
      data: saved,
      message: 'Report submitted successfully',
    } as any;
  }

  async findAll(): Promise<any[]> {
    return this.findAllFormatted();
  }

  async findAllFormatted(limit?: number): Promise<any[]> {
    const query = this.reportModel.find().sort({ createdAt: -1 }).lean();

    if (limit) {
      query.limit(limit);
    }

    const reports = await query.exec();

    return Promise.all(
      reports.map(async (report) => {
        let reportedBy = 'Unknown';
        const reporter = await this.userModel
          .findById(report.reporterId)
          .select('name')
          .lean()
          .exec();
        reportedBy = reporter?.name || 'Unknown';

        let postedBy = 'Unknown';
        if (report.targetType === 'post') {
          const post = await this.postModel
            .findById(report.targetId)
            .select('userName userId')
            .lean()
            .exec();

          if (post) {
            postedBy = post.userName || 'Unknown';
            if ((postedBy === 'Unknown' || !postedBy) && post.userId) {
              const author = await this.userModel
                .findById(post.userId)
                .select('name')
                .lean()
                .exec();
              postedBy = author?.name || 'Unknown';
            }
          }
        } else if (report.targetType === 'user') {
          const user = await this.userModel
            .findById(report.targetId)
            .select('name')
            .lean()
            .exec();
          postedBy = user?.name || 'Unknown';
        }

        return {
          id: report._id,
          reporterId: report.reporterId,
          reportedBy,
          reportType: report.targetType.toUpperCase(),
          targetId: report.targetId,
          postedBy,
          note: report.note,
          image: (report as any).image,
          reportedDate: report.createdAt,
          status:
            report.status.charAt(0).toUpperCase() + report.status.slice(1),
          createdAt: report.createdAt,
          updatedAt: (report as any).updatedAt,
        };
      }),
    );
  }

  async updateStatus(
    id: string,
    updateReportDto: UpdateReportDto,
    admin: any,
  ): Promise<Report> {
    const report = await this.reportModel.findByIdAndUpdate(
      id,
      {
        status: updateReportDto.status,
        resolvedBy: new Types.ObjectId(admin.userId),
      },
      { new: true },
    );

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    return {
      data: report,
      message: 'Report status updated successfully',
    } as any;
  }

  @OnEvent('user.deleted')
  async handleUserDeleted(userId: string) {
    const userObjId = new Types.ObjectId(userId);
    await this.reportModel.deleteMany({
      $or: [
        { reporterId: userObjId },
        { targetId: userObjId, targetType: 'user' },
      ],
    });
  }

  async remove(id: string): Promise<any> {
    const report = await this.reportModel.findByIdAndDelete(id).exec();
    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }
    return { message: 'Report deleted successfully' };
  }
}
