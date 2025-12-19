import { type DynamicModule, Global, Module } from "@nestjs/common";

import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from "./crypt.module-definition";
import { CryptService } from "./crypt.service";

/**
 * Module that provides encryption and decryption services using AES-256-GCM.
 *
 * @example
 * ```typescript
 * import { CryptModule } from '@nest-boot/crypt';
 *
 * @Module({
 *   imports: [
 *     CryptModule.register({
 *       secret: 'your-secret-key',
 *       isGlobal: true,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({ providers: [CryptService], exports: [CryptService] })
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
