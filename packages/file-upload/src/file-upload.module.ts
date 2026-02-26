import { Module } from "@nestjs/common";

import { ConfigurableModuleClass } from "./file-upload.module-definition";
import { FileUploadResolver } from "./file-upload.resolver";
import { FileUploadService } from "./file-upload.service";

/**
 * Module for handling file uploads using AWS S3 (or compatible services) and GraphQL.
 * It provides a service to generate presigned URLs for client-side uploads.
 */
@Module({
  providers: [FileUploadService, FileUploadResolver],
  exports: [FileUploadService],
})
export class FileUploadModule extends ConfigurableModuleClass {}
