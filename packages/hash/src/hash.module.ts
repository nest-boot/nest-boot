import { type DynamicModule, Global, Module } from "@nestjs/common";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from "./hash.module-definition";
import { HashService } from "./hash.service";

/**
 * Module that provides password hashing services using Argon2.
 *
 * @example
 * ```typescript
 * import { HashModule } from '@nest-boot/hash';
 *
 * @Module({
 *   imports: [
 *     HashModule.register({
 *       secret: 'your-secret-key',
 *       isGlobal: true,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({ providers: [HashService], exports: [HashService] })
export class HashModule extends ConfigurableModuleClass {
  /**
   * Registers the HashModule with the given options.
   * @param options - Configuration options including secret and isGlobal
   * @returns Dynamic module configuration
   */
  static override register(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(options);
  }

  /**
   * Registers the HashModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.registerAsync(options);
  }
}
