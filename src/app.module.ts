import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { awsConfig } from './config/aws.config';
import { MongooseModule } from '@nestjs/mongoose';
import { databaseConfig } from 'src/config/database.config';
import { Logger } from '@nestjs/common';
import { UploadsModule } from 'src/modules/uploads/uploads.module';

const logger = new Logger('Database');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [awsConfig],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        ...databaseConfig(),
        connectionFactory: (connection) => {
          if (connection.readyState === 1) {
            logger.log('Database started successfully🚀');
          }

          connection.on('connected', () => {
            logger.log('Database started successfully🚀');
          });

          connection.on('error', (error) => {
            logger.error(`Database connection error: ${error.message}`);
          });

          return connection;
        },
      }),
    }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
