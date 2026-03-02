import { registerAs } from '@nestjs/config';

export const awsConfig = registerAs('aws', () => ({
  public: {
    region: process.env.PUBLIC_AWS_REGION,
    accessKeyId: process.env.PUBLIC_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.PUBLIC_AWS_SECRET_ACCESS_KEY,
    bucketName: process.env.PUBLIC_AWS_S3_BUCKET,
    baseUrl: process.env.PUBLIC_FILE_BASE_URL,
  },
}));
