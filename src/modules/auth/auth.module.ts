import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthListener } from './auth.listener';
import { JwtRefreshStrategy } from './strategy/jwt-refresh.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';
import { MailModule } from 'src/modules/mail/mail.module';
import { UsersModule } from 'src/modules/users/users.module';
import { AuthOtp, AuthOtpSchema } from './schemas/auth-otp.schema';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    MailModule,
    MongooseModule.forFeature([{ name: AuthOtp.name, schema: AuthOtpSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        expiresIn: config.get<string>('JWT_ACC_EXPIRATION'),
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, AuthListener],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
