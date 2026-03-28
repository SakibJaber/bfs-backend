import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import { ReportsService } from '../reports/reports.service';
import { Role } from 'src/common/enum/role.enum';
import { UserStatus } from 'src/common/enum/user.status.enum';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly reportsService: ReportsService,
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
        this.reportsService.findAllFormatted(6),
      ]);

    return {
      stats: {
        totalUsers,
        activeUsers,
        totalPosts,
      },
      recentReports,
    };
  }
}
