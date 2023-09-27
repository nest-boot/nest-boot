import { S3 } from "aws-sdk";

export interface FileUploadLimit {
  fileSize: number;
  mimeTypes: string[];
}

export interface FileUploadModuleOptions extends S3.ClientConfiguration {
  bucket: string;
  expires?: number;
  limits?: FileUploadLimit[];
}
