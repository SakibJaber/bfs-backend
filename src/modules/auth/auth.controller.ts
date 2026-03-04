import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtRefreshGuard } from 'src/common/guards/jwt-refresh.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';

// ─── DTOs (re-using existing files) ──────────────────────────────────────────
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyRegistrationOtpDto } from './dto/verify-registration-otp.dto';
import { SendResetPasswordOtpDto } from './dto/send-reset-password-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  // ─── Registration ─────────────────────────────────────────────────────────────

  /**
   * POST /auth/register
   * Sends OTP to the given email. Does NOT create the account yet.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    try {
      const result = await this.authService.sendRegistrationOtp(dto);
      return {
        success: true,
        statusCode: 200,
        message: result.message,
        data: result.otp ? { otp: result.otp } : null,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'Registration failed' },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /auth/verify-otp
   * Verifies the registration OTP and activates the account. Returns tokens.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyRegistrationOtpDto) {
    try {
      const result = await this.authService.verifyRegistrationOtp(
        dto.email,
        dto.otp,
      );
      return {
        success: true,
        statusCode: 201,
        message: result.message,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'OTP verification failed' },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ─── Login ────────────────────────────────────────────────────────────────────

  /**
   * POST /auth/login
   * Authenticates with email + password. Returns access + refresh tokens.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    try {
      const result = await this.authService.login(dto.email, dto.password);
      return {
        success: true,
        statusCode: 200,
        message: 'Login successful',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'Login failed' },
        error.status || HttpStatus.UNAUTHORIZED,
      );
    }
  }

  // ─── Token Refresh ────────────────────────────────────────────────────────────

  /**
   * POST /auth/refresh
   * Send the refresh token as Bearer in Authorization header.
   * Returns a new access token (and rotated refresh token).
   */
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refresh(@Req() req) {
    try {
      const tokens = await this.authService.refreshTokens(
        req.user.userId,
        req.user.refreshToken,
      );
      return {
        success: true,
        statusCode: 200,
        message: 'Tokens refreshed successfully',
        data: tokens,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'Token refresh failed' },
        error.status || HttpStatus.UNAUTHORIZED,
      );
    }
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────

  /**
   * POST /auth/logout
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req) {
    try {
      await this.authService.logout(req.user.userId);
      return {
        success: true,
        statusCode: 200,
        message: 'Logged out successfully',
        data: null,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'Logout failed' },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ─── Get Authenticated User ───────────────────────────────────────────────────

  /**
   * GET /auth/me
   * Returns the authenticated user's own profile (requires valid access token).
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req) {
    try {
      const data = await this.usersService.getProfile(req.user.userId);
      return {
        success: true,
        statusCode: 200,
        message: 'Profile fetched successfully',
        data,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'Failed to fetch profile' },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ─── Forgot / Reset Password ──────────────────────────────────────────────────

  /**
   * POST /auth/forgot-password
   * Sends a password-reset OTP. Response is always the same to prevent enumeration.
   */
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: SendResetPasswordOtpDto) {
    const result = await this.authService.sendPasswordResetOtp(dto.email);
    return {
      success: true,
      statusCode: 200,
      message: result.message,
      data: result.otp ? { otp: result.otp } : null,
    };
  }

  /**
   * POST /auth/verify-reset-otp
   * Verifies the reset OTP. Returns a short-lived resetToken.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-reset-otp')
  async verifyResetOtp(@Body() dto: VerifyResetOtpDto) {
    try {
      const result = await this.authService.verifyPasswordResetOtp(
        dto.email,
        dto.otp,
      );
      return {
        success: true,
        statusCode: 200,
        message: result.message,
        data: { resetToken: result.resetToken },
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'OTP verification failed' },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /auth/reset-password
   * Resets the password using the resetToken from /verify-reset-otp.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    try {
      const result = await this.authService.resetPassword(
        dto.resetToken,
        dto.newPassword,
      );
      return {
        success: true,
        statusCode: 200,
        message: result.message,
        data: null,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message || 'Password reset failed' },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ─── OTP Resend (legacy alias endpoints kept for backward compat) ─────────────

  /**
   * POST /auth/resend-otp
   * Resends registration OTP (if not verified) or triggers password-reset OTP (if verified).
   */
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('resend-otp')
  async resendOtp(@Body() dto: ResendOtpDto) {
    const result = await this.authService.resendOtp(dto.email);
    return {
      success: true,
      statusCode: 200,
      message: result.message,
      data: null,
    };
  }

  /**
   * POST /auth/verify-reg-otp  (legacy alias → same as /verify-otp)
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-reg-otp')
  async verifyRegOtp(@Body() dto: VerifyRegistrationOtpDto) {
    return this.verifyOtp(dto);
  }

  /**
   * POST /auth/send-reset-otp  (legacy alias → same as /forgot-password)
   */
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('send-reset-otp')
  async sendResetOtp(@Body() dto: SendResetPasswordOtpDto) {
    return this.forgotPassword(dto);
  }
}
