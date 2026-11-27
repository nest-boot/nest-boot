import { withDynamicController } from "@nest-boot/common";
import { DatabaseModule } from "@nest-boot/database";
import { type DynamicModule, Global, Module } from "@nestjs/common";

import { JwksController } from "./controllers/jwks.controller.js";
import { Jwk } from "./entities/jwk.entity.js";
import type { JwtModuleOptions } from "./interfaces/jwt-module-options.interface.js";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./jwt.module-definition.js";
import { JwtService } from "./services/jwt.service.js";
import { resolveJwksOptions } from "./utils/resolve-jwks-options.js";

/** Signs and verifies application JWTs using database-backed signing keys. */
@Global()
@Module({
  imports: [DatabaseModule.forFeatureAsync({ useFactory: () => [Jwk] })],
  providers: [JwtService],
  exports: [JwtService],
})
export class JwtModule extends ConfigurableModuleClass {
  /**
   * Registers JWT signing with explicit or environment-backed configuration.
   * @param options - JWT issuer, key encryption and JWKS settings.
   * @returns Dynamic JWT module.
   */
  static override forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    return this.withJwksController(super.forRoot(options));
  }

  /**
   * Registers JWT signing using asynchronously resolved configuration.
   * @param options - Factory and dependency injection settings.
   * @returns Dynamic JWT module.
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return this.withJwksController(super.forRootAsync(options));
  }

  private static withJwksController(
    dynamicModule: DynamicModule,
  ): DynamicModule {
    return withDynamicController(dynamicModule, JwksController, {
      inject: [MODULE_OPTIONS_TOKEN],
      useFactory: (options: JwtModuleOptions) =>
        resolveJwksOptions(options.jwks),
    });
  }
}
