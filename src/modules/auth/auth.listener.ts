import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailService } from '../mail/mail.service';

/**
 * AuthListener handles mail delivery for auth events emitted by AuthService.
 * Decoupled via EventEmitter so AuthService never imports MailService directly.
 */
@Injectable()
export class AuthListener {
  private readonly logger = new Logger(AuthListener.name);

  constructor(private readonly mailService: MailService) {}

  @OnEvent('auth.registration_otp_sent')
  async handleRegistrationOtp(payload: { email: string; otp: string }) {
    this.logger.log(`Sending registration OTP to ${payload.email}`);
    try {
      await this.mailService.sendEmailVerificationOtp(
        payload.email,
        payload.otp,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send registration OTP to ${payload.email}: ${error.message}`,
      );
    }
  }

  @OnEvent('auth.password_reset_otp_sent')
  async handlePasswordResetOtp(payload: { email: string; otp: string }) {
    this.logger.log(`Sending password reset OTP to ${payload.email}`);
    try {
      await this.mailService.sendResetPasswordOtp(payload.email, payload.otp);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset OTP to ${payload.email}: ${error.message}`,
      );
    }
  }
}
