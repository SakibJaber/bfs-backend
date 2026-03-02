import {
  Injectable,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import {
  UploadsModuleOptions,
  UPLOADS_OPTIONS_TOKEN,
} from './interfaces/uploads-options.interface';

@Injectable()
export class UploadsService {
  private s3: S3Client;
  private bucket: string;

  constructor(
    @Inject(UPLOADS_OPTIONS_TOKEN)
    private readonly options: UploadsModuleOptions,
  ) {
    this.s3 = new S3Client({
      region: this.options.aws.region,
      credentials: {
        accessKeyId: this.options.aws.accessKeyId,
        secretAccessKey: this.options.aws.secretAccessKey,
      },
    });

    this.bucket = this.options.aws.bucketName;
  }

  async uploadBuffer(
    buffer: Buffer,
    mimeType: string,
    folder: string,
    originalName: string,
    userId?: string,
  ): Promise<string> {
    const extension = originalName.split('.').pop() || 'bin';
    const fileKey = `${folder}/${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
    });

    await this.s3.send(command);

    return fileKey;
  }
}
