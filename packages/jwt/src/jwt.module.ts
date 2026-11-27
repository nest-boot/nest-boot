import { createDynamicController } from "@nest-boot/common";
import { DatabaseModule } from "@nest-boot/database";
import { type DynamicModule, Global, Module } from "@nestjs/common";

import { JwksController } from "./controllers/jwks.controller.js";
import { Jwk } from "./entities/jwk.entity.js";
import type { JwtModuleOptions } from "./interfaces/jwt-module-options.interface.js";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from "./jwt.module-definition.js";
import { JwtService } from "./services/jwt.service.js";
import { resolveJwksOptions } from "./utils/resolve-jwks-options.util.js";

const jwksController = createDynamicController(JwksController, {
  inject: [{ token: MODULE_OPTIONS_TOKEN, optional: true }],
  useFactory: (options?: JwtModuleOptions) => resolveJwksOptions(options?.jwks),
});

/** Signs and verifies application JWTs using database-backed signing keys. */
@Global()
@Module({
  imports: [DatabaseModule.forFeatureAsync({ useFactory: () => [Jwk] })],
  controllers: [jwksController.controller],
  providers: [JwtService, jwksController.provider],
  exports: [JwtService],
})
export class JwtModule extends ConfigurableModuleClass {
  /**
   * Registers JWT signing with explicit or environment-backed configuration.
   * @param options - JWT issuer, key encryption and JWKS settings.
   * @returns Dynamic JWT module.
   */
  static override forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    return super.forRoot(options);
  }
}
