import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsersService } from '../users/users.service';
import { Role } from 'src/common/enum/role.enum';
import { UserStatus } from 'src/common/enum/user.status.enum';
import { AuthOtp, AuthOtpDocument } from './schemas/auth-otp.schema';

const SALT_ROUNDS = 10;
const OTP_RATE_LIMIT_SECONDS = 60; // minimum gap between OTP requests

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(AuthOtp.name)
    private readonly authOtpModel: Model<AuthOtpDocument>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Registration ─────────────────────────────────────────────────────────────

  /**
   * Step 1: Send OTP to the given email to verify before account creation.
   * Creates (or updates) a pending unverified user record.
   */
  async sendRegistrationOtp(data: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }) {
    // If already verified, reject
    const existingUser = await this.usersService.findByEmail(data.email);
    if (existingUser?.isEmailVerified) {
      throw new BadRequestException('Email already registered');
    }

    // Rate-limit OTP requests
    await this.enforceOtpRateLimit(data.email, 'verification');

    const expiresAt = this.otpExpiresAt();
    const otp = this.generateOtp();
    const [hashedOtp, hashedPassword] = await Promise.all([
      bcrypt.hash(otp, SALT_ROUNDS),
      bcrypt.hash(data.password, SALT_ROUNDS),
    ]);

    // Persist/update OTP in auth_otps collection
    await this.authOtpModel.findOneAndUpdate(
      { email: data.email, type: 'verification' },
      { email: data.email, otp: hashedOtp, expiresAt, type: 'verification' },
      { upsert: true, returnDocument: 'after' },
    );

    // Upsert pending user
    await this.usersService.userModel.findOneAndUpdate(
      { email: data.email },
      {
        email: data.email,
        name: data.name,
        password: hashedPassword,
        role: data.role,
        isEmailVerified: false,
      },
      { upsert: true, returnDocument: 'after' },
    );

    this.eventEmitter.emit('auth.registration_otp_sent', {
      email: data.email,
      otp,
    });

    return {
      message: 'OTP sent to your email. Please verify within 5 minutes.',
      ...(process.env.NODE_ENV === 'development' && { otp }),
    };
  }

  /**
   * Step 2: Verify OTP and activate the user account. Returns tokens on success.
   */
  async verifyRegistrationOtp(email: string, otp: string) {
    const otpDoc = await this.authOtpModel.findOne({
      email,
      type: 'verification',
    });
    if (!otpDoc)
      throw new UnauthorizedException(
        'No OTP found. Please request one first.',
      );

    if (new Date() > otpDoc.expiresAt) {
      await otpDoc.deleteOne();
      throw new UnauthorizedException(
        'OTP has expired. Please request a new one.',
      );
    }

    const isValid = await bcrypt.compare(otp, otpDoc.otp);
    if (!isValid) throw new UnauthorizedException('Invalid OTP');

    // Mark user as verified and remove OTP
    await Promise.all([
      this.usersService.userModel.findOneAndUpdate(
        { email },
        {
          isEmailVerified: true,
          emailVerificationOtp: null,
          emailVerificationOtpExpires: null,
        },
      ),
      otpDoc.deleteOne(),
    ]);

    const user = await this.usersService.findByEmail(email);
    if (!user)
      throw new UnauthorizedException('User not found after verification');

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.role,
      user.email,
    );
    await this.usersService.updateRefreshToken(
      user._id.toString(),
      tokens.refreshToken,
    );

    return {
      message: 'Email verified successfully. Welcome!',
      user: { name: user.name, email: user.email, role: user.role },
      ...tokens,
    };
  }

  // ─── Login ────────────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Email not verified. Please verify your email first.',
      );
    }

    await this.assertUserActive(user);

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.role,
      user.email,
    );
    await this.usersService.updateRefreshToken(
      user._id.toString(),
      tokens.refreshToken,
    );

    return {
      user: { userId: user._id.toString(), name: user.name, email: user.email, role: user.role },
      ...tokens,
    };
  }

  // ─── Token Refresh ────────────────────────────────────────────────────────────

  async refreshTokens(userId: string, refreshToken: string) {
    // Force selection of refreshToken in case it's ever hidden in schema
    const user = await this.usersService.userModel
      .findById(userId)
      .select('+refreshToken')
      .lean();

    if (!user || !(user as any).refreshToken) {
      throw new ForbiddenException('Session expired. Please login again.');
    }

    await this.assertUserActive(user);

    const matches = await bcrypt.compare(
      refreshToken,
      (user as any).refreshToken,
    );
    if (!matches) throw new ForbiddenException('Invalid refresh token');

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.role,
      user.email,
    );
    await this.usersService.updateRefreshToken(
      user._id.toString(),
      tokens.refreshToken,
    );
    return tokens;
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  // ─── Forgot / Reset Password ──────────────────────────────────────────────────

  /**
   * Sends a password-reset OTP. Always returns same message to prevent email enumeration.
   */
  async sendPasswordResetOtp(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Do NOT reveal whether the email exists
      return { message: 'If that email is registered, an OTP has been sent.' };
    }

    // Rate-limit
    await this.enforceOtpRateLimit(email, 'forgot_password');

    const expiresAt = this.otpExpiresAt(5); // 5-minute window
    const otp = this.generateOtp();
    const hashedOtp = await bcrypt.hash(otp, SALT_ROUNDS);

    await this.authOtpModel.findOneAndUpdate(
      { email, type: 'forgot_password' },
      { email, otp: hashedOtp, expiresAt, type: 'forgot_password' },
      { upsert: true, returnDocument: 'after' },
    );

    this.eventEmitter.emit('auth.password_reset_otp_sent', { email, otp });

    return {
      message: 'If that email is registered, an OTP has been sent.',
      ...(process.env.NODE_ENV === 'development' && { otp }),
    };
  }

  /**
   * Verifies the reset OTP and issues a short-lived reset token.
   */
  async verifyPasswordResetOtp(email: string, otp: string) {
    const otpDoc = await this.authOtpModel.findOne({
      email,
      type: 'forgot_password',
    });
    if (!otpDoc) throw new UnauthorizedException('Invalid or expired OTP');

    if (new Date() > otpDoc.expiresAt) {
      await otpDoc.deleteOne();
      throw new UnauthorizedException(
        'OTP has expired. Please request a new one.',
      );
    }

    const isValid = await bcrypt.compare(otp, otpDoc.otp);
    if (!isValid) throw new UnauthorizedException('Invalid OTP');

    // OTP consumed — remove it
    await otpDoc.deleteOne();

    // Issue a short-lived reset token
    const resetToken = await this.jwtService.signAsync(
      { email, type: 'password_reset' },
      { secret: this.config.get<string>('JWT_SECRET'), expiresIn: '15m' },
    );

    return {
      message: 'OTP verified. Use the resetToken to set a new password.',
      resetToken,
    };
  }

  /**
   * Validates the reset token and updates the password.
   */
  async resetPassword(resetToken: string, newPassword: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(resetToken, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (payload?.type !== 'password_reset') {
      throw new UnauthorizedException('Invalid reset token');
    }

    await this.usersService.updatePassword(payload.email, newPassword);
    return { message: 'Password has been reset successfully. Please login.' };
  }

  // ─── Resend OTP ───────────────────────────────────────────────────────────────

  async resendOtp(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Mask existence for security
      return {
        message: 'If that email is registered, an OTP has been resent.',
      };
    }

    if (!user.isEmailVerified) {
      const otp = this.generateOtp();
      const hashedOtp = await bcrypt.hash(otp, SALT_ROUNDS);
      const expiresAt = this.otpExpiresAt();

      await Promise.all([
        this.usersService.saveEmailVerificationOtp(email, hashedOtp, expiresAt),
        this.authOtpModel.findOneAndUpdate(
          { email, type: 'verification' },
          { email, otp: hashedOtp, expiresAt, type: 'verification' },
          { upsert: true },
        ),
      ]);
      this.eventEmitter.emit('auth.registration_otp_sent', { email, otp });
    } else {
      return this.sendPasswordResetOtp(email);
    }

    return {
      message: 'OTP resent.',
      ...(process.env.NODE_ENV === 'development' ? {} : {}),
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  private async generateTokens(userId: string, role: string, email: string) {
    const payload = { userId, role, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: (this.config.get<string>('JWT_ACC_EXPIRATION') ??
          '15m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.config.get<string>('JWT_REF_EXPIRATION') ??
          '7d') as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private otpExpiresAt(minutes?: number): Date {
    const mins =
      minutes ??
      parseInt(this.config.get<string>('OTP_EXPIRATION_MINUTES') ?? '5');
    return new Date(Date.now() + mins * 60 * 1000);
  }

  private async enforceOtpRateLimit(
    email: string,
    type: 'verification' | 'forgot_password',
  ) {
    const existing = await this.authOtpModel.findOne({ email, type }).lean();
    if (existing) {
      const secondsSinceCreated =
        (Date.now() - new Date(existing['createdAt'] ?? 0).getTime()) / 1000;
      if (secondsSinceCreated < OTP_RATE_LIMIT_SECONDS) {
        const waitSeconds = Math.ceil(
          OTP_RATE_LIMIT_SECONDS - secondsSinceCreated,
        );
        throw new BadRequestException(
          `Please wait ${waitSeconds} seconds before requesting another OTP.`,
        );
      }
    }
  }

  private async assertUserActive(user: any) {
    switch (user.status) {
      case UserStatus.BLOCKED:
        throw new UnauthorizedException('Your account has been blocked.');
      case UserStatus.PENDING:
        throw new UnauthorizedException('Your account is pending approval.');
      case UserStatus.REJECTED:
        throw new UnauthorizedException('Your account has been rejected.');
    }
  }

  // ─── Aliases kept for backward compat with existing controller ────────────────

  /** @deprecated use sendRegistrationOtp */
  async register(data: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }) {
    return this.sendRegistrationOtp(data);
  }

  /** @deprecated use verifyRegistrationOtp */
  async verifyRegistrationOtpAlias(email: string, otp: string) {
    return this.verifyRegistrationOtp(email, otp);
  }

  /** @deprecated use sendPasswordResetOtp */
  async sendPasswordResetOtpAlias(email: string) {
    return this.sendPasswordResetOtp(email);
  }

  /** @deprecated use verifyPasswordResetOtp */
  async verifyPasswordResetOtpAlias(email: string, otp: string) {
    return this.verifyPasswordResetOtp(email, otp);
  }
}
