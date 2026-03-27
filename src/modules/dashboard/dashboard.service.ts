import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import { Report, ReportDocument } from '../reports/schemas/report.schema';
import { Role } from 'src/common/enum/role.enum';
import { UserStatus } from 'src/common/enum/user.status.enum';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
  ) {}

  async getDashboardStats() {
    const [totalUsers, activeUsers, totalPosts, recentReports] =
      await Promise.all([
        this.userModel.countDocuments({ role: { $ne: Role.SUPER_ADMIN } }),
        this.userModel.countDocuments({
          role: { $ne: Role.SUPER_ADMIN },
          status: UserStatus.ACTIVE,
        }),
        this.postModel.countDocuments({ status: 'active' }),
        this.reportModel
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .populate('reporterId', 'name')
          .lean()
          .exec(),
      ]);

    const formattedReports = await Promise.all(
      recentReports.map(async (report) => {
        let postedBy = 'Unknown';
        if (report.targetType === 'post') {
          const post = await this.postModel
            .findById(report.targetId)
            .select('userName')
            .lean()
            .exec();
          postedBy = post?.userName || 'Unknown';
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
          reportedBy: (report.reporterId as any)?.name || 'Unknown',
          reportType: report.targetType.toUpperCase(),
          postedBy,
          note: report.note,
          reportedDate: report.createdAt,
          status:
            report.status.charAt(0).toUpperCase() + report.status.slice(1),
        };
      }),
    );

    return {
      stats: {
        totalUsers,
        activeUsers,
        totalPosts,
      },
      recentReports: formattedReports,
    };
  }
}
