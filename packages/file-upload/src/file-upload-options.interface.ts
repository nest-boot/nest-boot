import { ClientOptions } from "minio";

export interface FileUploadLimit {
  fileSize: number;
  mimeTypes: string[];
}

export interface FileUploadModuleOptions extends ClientOptions {
  bucket: string;
  expires?: number;
  limits?: FileUploadLimit[];
}
