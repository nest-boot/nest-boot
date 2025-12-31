import { type DynamicModule, Global, Module } from "@nestjs/common";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./crypt.module-definition";
import { CryptService } from "./crypt.service";
import { CryptModuleOptions } from "./crypt-module-options.interface";
import { estimateEntropy } from "./utils/estimate-entropy";

/**
 * Module that provides encryption and decryption services using JWE (A256GCMKW + A256GCM).
 *
 * Uses HKDF to derive a 32-byte key from the secret, so secrets of any length are accepted.
 *
 * @example
 * ```typescript
 * import { CryptModule } from '@nest-boot/crypt';
 *
 * @Module({
 *   imports: [
 *     CryptModule.register({
 *       secret: process.env.CRYPT_SECRET
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
      provide: CryptService,
      inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
      useFactory: (options: CryptModuleOptions) => {
        const secret =
          options.secret ?? process.env.CRYPT_SECRET ?? process.env.APP_SECRET;

        if (!secret) {
          throw new Error(
            "Crypt secret is required.\n" +
              "Set CRYPT_SECRET or APP_SECRET environment variable, or pass a secret option.\n" +
              "Generate a secure secret with:\n" +
              "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
          );
        }

        if (secret.length < 32) {
          throw new Error(
            "Crypt secret must be at least 32 characters long.\n" +
              "Set CRYPT_SECRET or APP_SECRET environment variable, or pass a secret option.\n" +
              "Generate a secure secret with:\n" +
              "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
          );
        }

        if (estimateEntropy(secret) < 120) {
          throw new Error(
            "Crypt secret appears low-entropy.\n" +
              "Use a randomly generated secret for production.\n" +
              "Generate a secure secret with:\n" +
              "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
          );
        }

        CryptService.init(secret);

        return CryptService.instance;
      },
    },
  ],
  exports: [CryptService],
})
export class CryptModule extends ConfigurableModuleClass {
  /**
   * Registers the CryptModule with the given options.
   * @param options - Configuration options including secret and isGlobal
   * @returns Dynamic module configuration
   */
  static override register(options: typeof OPTIONS_TYPE): DynamicModule {
    return super.register(options);
  }

  /**
   * Registers the CryptModule asynchronously with factory functions.
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return super.registerAsync(options);
  }
}
