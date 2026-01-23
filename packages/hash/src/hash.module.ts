import { type DynamicModule, Global, Module } from "@nestjs/common";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./hash.module-definition";
import { HashService } from "./hash.service";
import { HashModuleOptions } from "./hash-module-options.interface";
import { estimateEntropy } from "./utils/estimate-entropy";

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
 *       secret: process.env.HASH_SECRET
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * Generate a secure secret:
 * ```bash
 * node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
 * ```
 */
@Global()
@Module({
  providers: [
    {
      provide: HashService,
      inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options?: HashModuleOptions) => {
        const secret =
          options?.secret ?? process.env.HASH_SECRET ?? process.env.APP_SECRET;

        if (!secret) {
          throw new Error(
            "Hash secret is required.\n" +
              "Set HASH_SECRET or APP_SECRET environment variable, or pass a secret option.\n" +
              "Generate a secure secret with:\n" +
              "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
          );
        }

        if (secret.length < 32) {
          throw new Error(
            "Hash secret must be at least 32 characters long.\n" +
              "Set HASH_SECRET or APP_SECRET environment variable, or pass a secret option.\n" +
              "Generate a secure secret with:\n" +
              "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
          );
        }

        if (estimateEntropy(secret) < 120) {
          throw new Error(
            "Hash secret appears low-entropy.\n" +
              "Use a randomly generated secret for production.\n" +
              "Generate a secure secret with:\n" +
              "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
          );
        }

        HashService.init(secret);

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
