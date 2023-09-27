import { Module } from "@nestjs/common";

import { ConfigurableModuleClass } from "./file-upload.module-definition";
import { FileUploadResolver } from "./file-upload.resolver";
import { FileUploadService } from "./file-upload.service";

@Module({
  providers: [FileUploadService, FileUploadResolver],
  exports: [FileUploadService, FileUploadResolver],
})
export class FileUploadModule extends ConfigurableModuleClass {}
