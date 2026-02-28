import { type DynamicModule, Module } from "@nestjs/common";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from "./file-upload.module-definition";
import { FileUploadResolver } from "./file-upload.resolver";
import { FileUploadService } from "./file-upload.service";

/**
 * File upload module providing upload handling via GraphQL.
 *
 * @remarks
 * Registers the {@link FileUploadService} and GraphQL resolver
 * for handling file upload operations.
 */
@Module({
  providers: [FileUploadService, FileUploadResolver],
  exports: [FileUploadService],
})
export class FileUploadModule extends ConfigurableModuleClass {
  /**
   * Registers the FileUploadModule with the given options.
   * @param options - Configuration options
   * @returns Dynamic module configuration
   */
  static override register(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(options);
  }

  /**
   * Registers the FileUploadModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.registerAsync(options);
  }
}
