export interface UploadsModuleOptions {
  aws: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  };
  signedUrlExpireSeconds?: number;
}

export const UPLOADS_OPTIONS_TOKEN = 'UPLOADS_OPTIONS';
