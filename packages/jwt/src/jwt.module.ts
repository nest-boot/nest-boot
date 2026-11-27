import { DatabaseModule } from "@nest-boot/database";
import {
  Controller,
  type DynamicModule,
  Global,
  Module,
  type Type,
} from "@nestjs/common";
import { ModulesContainer } from "@nestjs/core";

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

const ENHANCER_METADATA_ENTRIES = [
  ["__guards__", "guard"],
  ["__interceptors__", "interceptor"],
  ["__pipes__", "pipe"],
  ["__exceptionFilters__", "filter"],
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
          inject: [MODULE_OPTIONS_TOKEN, ModulesContainer],
          useFactory: (
            options: JwtModuleOptions,
            modulesContainer: ModulesContainer,
          ) => {
            const jwks = resolveJwksOptions(options.jwks);
            Controller(jwks.path)(controller);
            for (const decorator of jwks.decorators) {
              decorator(controller);
            }

            const hostModule = [...modulesContainer.values()].find(
              (moduleRef) => moduleRef.controllers.has(controller),
            );
            if (hostModule) {
              for (const [metadataKey, subtype] of ENHANCER_METADATA_ENTRIES) {
                const enhancers = Reflect.getMetadata(
                  metadataKey,
                  controller,
                ) as unknown[] | undefined;
                for (const enhancer of enhancers ?? []) {
                  if (typeof enhancer === "function") {
                    const enhancerType = enhancer as Type;
                    hostModule.addInjectable(enhancerType, subtype, controller);
                    const wrapper = hostModule.injectables.get(enhancerType);
                    if (wrapper && !wrapper.instance) {
                      wrapper.instance = Object.create(
                        enhancerType.prototype as object,
                      ) as object;
                    }
                  }
                }
              }
            }
          },
        },
      ],
    };
  }
}
