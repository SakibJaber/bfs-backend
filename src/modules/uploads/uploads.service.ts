import {
  Injectable,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import {
  UploadsModuleOptions,
  UPLOADS_OPTIONS_TOKEN,
} from './interfaces/uploads-options.interface';

// ─── Constants ───────────────────────────────────────────────────────────────
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
]);

export const MAX_VIDEO_DURATION_SECONDS = 10;

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private s3: S3Client;
  private bucket: string;
  private region: string;

  constructor(
    @Inject(UPLOADS_OPTIONS_TOKEN)
    private readonly options: UploadsModuleOptions,
  ) {
    this.region = this.options.aws.region;
    this.bucket = this.options.aws.bucketName;
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.options.aws.accessKeyId,
        secretAccessKey: this.options.aws.secretAccessKey,
      },
    });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * General purpose buffer upload.
   */
  async uploadBuffer(
    buffer: Buffer,
    mimeType: string,
    folder: string,
    originalName: string,
  ): Promise<string> {
    const key = this.buildKey(folder, originalName);
    await this.putObject(key, buffer, mimeType);
    return this.buildPublicUrl(key);
  }

  /**
   * Specialized image upload with validation.
   */
  async uploadImage(
    buffer: Buffer,
    mimeType: string,
    originalName: string,
    folder = 'uploads/images',
  ): Promise<string> {
    this.validateImageMime(mimeType);
    return this.uploadBuffer(buffer, mimeType, folder, originalName);
  }

  /**
   * Specialized video upload with validation and processing stubs.
   */
  async uploadVideo(
    buffer: Buffer,
    mimeType: string,
    originalName: string,
    folder = 'uploads/videos',
  ): Promise<{
    url: string;
    thumbnailUrl: string | null;
    durationSeconds: number;
  }> {
    this.validateVideoMime(mimeType);

    // Validate duration (stub)
    const duration = await this.getVideoDurationSeconds(buffer);
    if (duration > MAX_VIDEO_DURATION_SECONDS) {
      throw new BadRequestException(
        `Video duration (${duration}s) exceeds maximum of ${MAX_VIDEO_DURATION_SECONDS}s`,
      );
    }

    // Upload video
    const url = await this.uploadBuffer(buffer, mimeType, folder, originalName);

    // Generate & upload thumbnail (stub)
    let thumbnailUrl: string | null = null;
    const thumbBuffer = await this.generateVideoThumbnail(buffer);
    if (thumbBuffer) {
      const thumbOriginalName = `thumb_${originalName}.jpg`;
      thumbnailUrl = await this.uploadBuffer(
        thumbBuffer,
        'image/jpeg',
        `${folder}/thumbnails`,
        thumbOriginalName,
      );
    }

    return { url, thumbnailUrl, durationSeconds: duration };
  }

  /**
   * Delete object by its public URL.
   */
  async deleteByUrl(publicUrl: string): Promise<void> {
    try {
      const key = this.extractKeyFromUrl(publicUrl);
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.log(`Deleted S3 object: ${key}`);
    } catch (err) {
      this.logger.warn(
        `Failed to delete S3 object for URL ${publicUrl}: ${err.message}`,
      );
    }
  }

  // ─── Validation Helpers ────────────────────────────────────────────────────

  validateImageMime(mimeType: string): void {
    if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
      throw new BadRequestException(
        `Unsupported image type: ${mimeType}. Allowed: ${[...ALLOWED_IMAGE_MIMES].join(', ')}`,
      );
    }
  }

  validateVideoMime(mimeType: string): void {
    if (!ALLOWED_VIDEO_MIMES.has(mimeType)) {
      throw new BadRequestException(
        `Unsupported video type: ${mimeType}. Allowed: ${[...ALLOWED_VIDEO_MIMES].join(', ')}`,
      );
    }
  }

  // ─── Video Processing Stubs ────────────────────────────────────────────────

  private async getVideoDurationSeconds(_buffer: Buffer): Promise<number> {
    // TODO: Integrate FFmpeg/ffprobe
    return 0;
  }

  private async generateVideoThumbnail(
    _buffer: Buffer,
  ): Promise<Buffer | null> {
    // TODO: Integrate FFmpeg
    return null;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private buildKey(folder: string, originalName: string): string {
    const ext = originalName.split('.').pop() || 'bin';
    return `${folder}/${randomUUID()}.${ext}`;
  }

  private buildPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private extractKeyFromUrl(url: string): string {
    const parsed = new URL(url);
    return parsed.pathname.startsWith('/')
      ? parsed.pathname.slice(1)
      : parsed.pathname;
  }

  private async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
}
