import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { User } from '../users/schemas/user.schema';
import { Post } from '../posts/schemas/post.schema';
import { Report } from '../reports/schemas/report.schema';

describe('DashboardService', () => {
  let service: DashboardService;
  let userModel: any;
  let postModel: any;
  let reportModel: any;

  beforeEach(async () => {
    userModel = {
      countDocuments: jest.fn(),
      findById: jest.fn(),
    };
    postModel = {
      countDocuments: jest.fn(),
      findById: jest.fn(),
    };
    reportModel = {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Post.name), useValue: postModel },
        { provide: getModelToken(Report.name), useValue: reportModel },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return dashboard stats', async () => {
    userModel.countDocuments
      .mockResolvedValueOnce(18441)
      .mockResolvedValueOnce(15561);
    postModel.countDocuments.mockResolvedValue(1671);

    const mockReports = [
      {
        _id: '1',
        reporterId: { name: 'Michael Brown' },
        targetType: 'post',
        targetId: 'p1',
        note: 'Misleading info',
        status: 'resolved',
        createdAt: new Date(),
      },
    ];
    reportModel.exec.mockResolvedValue(mockReports);
    postModel.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ userName: 'Charlie Davis' }),
    });

    const result = await service.getDashboardStats();

    expect(result.stats.totalUsers).toBe(18441);
    expect(result.stats.activeUsers).toBe(15561);
    expect(result.stats.totalPosts).toBe(1671);
    expect(result.recentReports).toHaveLength(1);
    expect(result.recentReports[0].postedBy).toBe('Charlie Davis');
  });
});
