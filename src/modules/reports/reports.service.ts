import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument } from './schemas/report.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { UploadsService } from '../uploads/uploads.service';
import { PostsService } from '../posts/posts.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
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
      reporterId: new Types.ObjectId(user.id),
    });
    return newReport.save();
  }

  async findAll(): Promise<Report[]> {
    return this.reportModel.find().sort({ createdAt: -1 }).exec();
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
        resolvedBy: new Types.ObjectId(admin.id),
      },
      { new: true },
    );

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    return report;
  }
}
