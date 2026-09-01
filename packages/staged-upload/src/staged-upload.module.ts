import { type DynamicModule, Module } from "@nestjs/common";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from "./staged-upload.module-definition.js";
import { StagedUploadResolver } from "./staged-upload.resolver.js";
import { StagedUploadService } from "./staged-upload.service.js";

/**
 * Module for staging temporary uploads and promoting accepted objects.
 *
 * @remarks
 * Registers {@link StagedUploadService} and the staged upload GraphQL resolver.
 */
@Module({
  providers: [StagedUploadService, StagedUploadResolver],
  exports: [StagedUploadService],
})
export class StagedUploadModule extends ConfigurableModuleClass {
  /**
   * Registers the StagedUploadModule with the given options.
   * @param options - Configuration options
   * @returns Dynamic module configuration
   */
  static override register(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(options);
  }

  /**
   * Registers the StagedUploadModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.registerAsync(options);
  }
}
