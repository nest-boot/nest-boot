import { type DynamicModule, Global, Module } from "@nestjs/common";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./hash.module-definition";
import { HashService } from "./hash.service";
import { HashModuleOptions } from "./hash-module-options.interface";

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
@Module({
  providers: [
    {
      provide: HashService,
      inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options: HashModuleOptions) => {
        HashService.init(
          options.secret ?? process.env.HASH_SECRET ?? process.env.APP_SECRET,
        );

        return HashService.instance;
      },
    },
  ],
  exports: [HashService],
})
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
