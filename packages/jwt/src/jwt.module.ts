import { DatabaseModule } from "@nest-boot/database";
import { Controller, type DynamicModule, Global, Module } from "@nestjs/common";

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

const UNSUPPORTED_ENHANCER_METADATA_KEYS = [
  "__guards__",
  "__interceptors__",
  "__pipes__",
  "__exceptionFilters__",
] as const;

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
    return this.withController(super.forRoot(options));
  }

  /**
   * Registers JWT signing using asynchronously resolved configuration.
   * @param options - Factory and dependency injection settings.
   * @returns Dynamic JWT module.
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return this.withController(super.forRootAsync(options));
  }

  private static withController(dynamicModule: DynamicModule): DynamicModule {
    const controller = class extends JwksController {};
    Object.defineProperty(controller, "name", { value: JwksController.name });

    return {
      ...dynamicModule,
      controllers: [controller],
      providers: [
        ...(dynamicModule.providers ?? []),
        {
          provide: Symbol("JWKS_CONTROLLER"),
          inject: [MODULE_OPTIONS_TOKEN],
          useFactory: (options: JwtModuleOptions) => {
            const jwks = resolveJwksOptions(options.jwks);
            Controller(jwks.path)(controller);
            for (const decorator of jwks.decorators) {
              decorator(controller);
            }
            if (
              UNSUPPORTED_ENHANCER_METADATA_KEYS.some((key) =>
                Reflect.hasOwnMetadata(key, controller),
              )
            ) {
              throw new Error(
                "JWKS decorators only support metadata decorators; Nest enhancers (@UseGuards, @UseInterceptors, @UsePipes, @UseFilters) are not supported",
              );
            }
          },
        },
      ],
    };
  }
}
