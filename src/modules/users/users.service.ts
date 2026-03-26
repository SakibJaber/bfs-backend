import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { Profile, ProfileDocument } from './schemas/profile.schema';
import { Role } from 'src/common/enum/role.enum';
import { UserStatus } from 'src/common/enum/user.status.enum';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name)
    public readonly userModel: Model<UserDocument>,
    @InjectModel(Profile.name)
    private readonly profileModel: Model<ProfileDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── User Creation ──────────────────────────────────────────────────────────

  async createUser(data: {
    name: string;
    email: string;
    password: string;
    role: string;
    phone?: string;
    doctorId?: string;
    dateOfBirth?: Date | string;
    allergies?: string[];
    bloodGroup?: string;
    profileImage?: string;
  }) {
    const exists = await this.userModel.findOne({ email: data.email });
    if (exists) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    const dataToSave: any = {
      ...data,
      password: hashedPassword,
    };

    if (data.role === Role.ADMIN || data.role === Role.SUPER_ADMIN) {
      dataToSave.isEmailVerified = true;
    }

    const user = await this.userModel.create({ ...dataToSave });

    // Create a linked profile document
    await this.profileModel.create({
      userId: user._id,
      name: data.name,
      phone: data.phone ?? undefined,
    });

    return user;
  }

  async createAdmin(data: CreateAdminDto) {
    const admin = await this.createUser({
      ...data,
      role: Role.ADMIN,
    });

    this.eventEmitter.emit('admin.created', {
      email: data.email,
      name: data.name,
      password: data.password,
    });

    return admin;
  }

  // ─── Finders ────────────────────────────────────────────────────────────────

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).lean();
  }

  async findById(id: string) {
    return this.userModel.findById(id).select('-password').lean();
  }

  async findAll(query: any) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.userModel.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'profiles',
            localField: '_id',
            foreignField: 'userId',
            as: 'profile',
          },
        },
        { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            password: 0,
            refreshToken: 0,
            emailVerificationOtp: 0,
            emailVerificationOtpExpires: 0,
            passwordResetOtp: 0,
            passwordResetOtpExpires: 0,
          },
        },
        {
          $addFields: {
            phone: '$profile.phone',
          },
        },
      ]),
      this.userModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Profile ─────────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const [user, profile] = await Promise.all([
      this.userModel
        .findById(userId)
        .select(
          '-password -refreshToken -emailVerificationOtp -emailVerificationOtpExpires -passwordResetOtp -passwordResetOtpExpires',
        )
        .lean(),
      this.profileModel.findOne({ userId: new Types.ObjectId(userId) }).lean(),
    ]);

    if (!user) throw new NotFoundException('User not found');

    const result = {
      ...user,
      ...(profile || {}),
      _id: user._id, // Ensure user ID is preserved
    };
    if ('userId' in result) delete (result as any).userId;

    return result;
  }

  async getProfileByUserId(userId: string) {
    return this.profileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean();
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Update user document fields
    const userUpdates: any = {};
    if (dto.name) userUpdates.name = dto.name;

    if (Object.keys(userUpdates).length) {
      await this.userModel.findByIdAndUpdate(userId, userUpdates);
    }

    // Update profile document fields
    const profileUpdates: any = {};
    if (dto.name) profileUpdates.name = dto.name;
    if (dto.bio !== undefined) profileUpdates.bio = dto.bio;
    if (dto.phone) profileUpdates.phone = dto.phone;
    if (dto.socialLinks !== undefined)
      profileUpdates.socialLinks = dto.socialLinks;
    if (dto.avatarUrl) profileUpdates.avatarUrl = dto.avatarUrl;

    const profile = await this.profileModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: profileUpdates },
        { returnDocument: 'after', upsert: true },
      )
      .lean();

    const user = await this.userModel
      .findById(userId)
      .select('-password -refreshToken')
      .lean();

    if (!user) throw new NotFoundException('User not found');

    const result = {
      ...user,
      ...profile,
      _id: user._id,
    };
    if ('userId' in result) delete (result as any).userId;

    return result;
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    await this.profileModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { avatarUrl } },
      { upsert: true },
    );

    return this.getProfile(userId);
  }

  // ─── Password ────────────────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    data: { oldPassword: string; newPassword: string },
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const match = await bcrypt.compare(data.oldPassword, user.password);
    if (!match) throw new BadRequestException('Current password is incorrect');

    const hashedPassword = await bcrypt.hash(data.newPassword, SALT_ROUNDS);
    await this.userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
    });
  }

  // ─── Token & OTP ─────────────────────────────────────────────────────────────

  async updateRefreshToken(userId: string, refreshToken: string | null) {
    const hashedRefreshToken = refreshToken
      ? await bcrypt.hash(refreshToken, SALT_ROUNDS)
      : null;
    await this.userModel.findByIdAndUpdate(userId, {
      refreshToken: hashedRefreshToken,
    });
  }

  async saveEmailVerificationOtp(
    email: string,
    hashedOtp: string,
    expiresAt: Date,
  ) {
    await this.userModel.findOneAndUpdate(
      { email },
      {
        emailVerificationOtp: hashedOtp,
        emailVerificationOtpExpires: expiresAt,
      },
      { upsert: true },
    );
  }

  async verifyEmailVerificationOtp(
    email: string,
    otp: string,
  ): Promise<boolean> {
    const user = await this.userModel.findOne({ email });
    if (
      !user ||
      !user.emailVerificationOtp ||
      !user.emailVerificationOtpExpires
    ) {
      return false;
    }

    if (new Date() > user.emailVerificationOtpExpires) {
      return false;
    }

    const isValid = await bcrypt.compare(otp, user.emailVerificationOtp);
    if (isValid) {
      await this.userModel.findOneAndUpdate(
        { email },
        {
          isEmailVerified: true,
          emailVerificationOtp: null,
          emailVerificationOtpExpires: null,
        },
      );
    }
    return isValid;
  }

  async savePasswordResetOtp(
    email: string,
    hashedOtp: string,
    expiresAt: Date,
  ) {
    await this.userModel.findOneAndUpdate(
      { email },
      {
        passwordResetOtp: hashedOtp,
        passwordResetOtpExpires: expiresAt,
      },
    );
  }

  async verifyPasswordResetOtp(email: string, otp: string): Promise<boolean> {
    const user = await this.userModel.findOne({ email });
    if (!user || !user.passwordResetOtp || !user.passwordResetOtpExpires) {
      return false;
    }

    if (new Date() > user.passwordResetOtpExpires) {
      return false;
    }

    const isValid = await bcrypt.compare(otp, user.passwordResetOtp);
    if (isValid) {
      await this.userModel.findOneAndUpdate(
        { email },
        {
          passwordResetOtp: null,
          passwordResetOtpExpires: null,
        },
      );
    }
    return isValid;
  }

  async updatePassword(email: string, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userModel.findOneAndUpdate(
      { email },
      {
        password: hashedPassword,
        passwordResetOtp: null,
        passwordResetOtpExpires: null,
      },
    );
  }

  // ─── Admin Actions ────────────────────────────────────────────────────────────

  async deleteUser(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    await Promise.all([
      this.userModel.findByIdAndDelete(userId),
      this.profileModel.findOneAndDelete({
        userId: new Types.ObjectId(userId),
      }),
    ]);
  }

  /** @deprecated use deleteUser */
  async deleteAccount(userId: string) {
    return this.deleteUser(userId);
  }

  async toggleUserStatus(userId: string, requestingUserId?: string) {
    if (requestingUserId && userId === requestingUserId) {
      throw new BadRequestException('You cannot block/unblock yourself');
    }

    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const newStatus =
      user.status === UserStatus.BLOCKED
        ? UserStatus.ACTIVE
        : UserStatus.BLOCKED;

    return this.userModel.findByIdAndUpdate(
      userId,
      { status: newStatus },
      { returnDocument: 'after' },
    );
  }

  async changeRole(userId: string, role: string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { role },
      { returnDocument: 'after' },
    );
  }

  // ─── FCM Tokens ──────────────────────────────────────────────────────────────

  async registerFcmToken(userId: string, token: string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { fcmTokens: token } },
      { returnDocument: 'after' },
    );
  }

  async removeFcmToken(userId: string, token: string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { fcmTokens: token } },
      { returnDocument: 'after' },
    );
  }

  // ─── Legacy ──────────

  async getPendingRegistration(email: string) {
    return this.userModel.findOne({ email, isEmailVerified: false }).lean();
  }
}
