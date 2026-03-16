import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { awsConfig } from './config/aws.config';
import { databaseConfig } from 'src/config/database.config';
import { Logger } from '@nestjs/common';

// ─── Modules ────────────────────────────────────────────────────────────────
import { UploadsModule } from 'src/modules/uploads/uploads.module';
import { MailModule } from 'src/modules/mail/mail.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UsersModule } from 'src/modules/users/users.module';
import { DomainModule } from 'src/modules/domain.module';

const logger = new Logger('Database');

@Module({
  imports: [
    // ─── Config ─────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [awsConfig],
    }),

    // ─── Database ────────────────────────────────────────────────────────────
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async () => ({
        ...databaseConfig(),
        connectionFactory: (connection) => {
          if (connection.readyState === 1) {
            logger.log('Database started successfully 🚀');
          }
          connection.on('connected', () => logger.log('Database connected 🚀'));
          connection.on('error', (error) =>
            logger.error(`Database connection error: ${error.message}`),
          );
          return connection;
        },
      }),
    }),

    // ─── Event Emitter (required by Auth + Users listener) ────────────────────
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
    }),

    // ─── Rate Limiting ────────────────────────────────────────────────────────
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),

    // ─── AWS S3 Uploads (Global) ──────────────────────────────────────────────
    UploadsModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        aws: {
          region: configService.get<string>('aws.region')!,
          accessKeyId: configService.get<string>('aws.accessKeyId')!,
          secretAccessKey: configService.get<string>('aws.secretAccessKey')!,
          bucketName: configService.get<string>('aws.s3.bucketName')!,
        },
      }),
    }),

    // ─── Feature Modules ──────────────────────────────────────────────────────
    MailModule,
    UsersModule,
    AuthModule,
    DomainModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
