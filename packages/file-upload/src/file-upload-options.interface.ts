import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";

export interface FileUploadLimit {
  fileSize: number;
  mimeTypes: string[];
}

export interface FileUploadModuleOptions {
  client: S3Client | S3ClientConfig;
  url?: string;
  bucket: string;
  expires?: number;
  limits?: FileUploadLimit[];
}
