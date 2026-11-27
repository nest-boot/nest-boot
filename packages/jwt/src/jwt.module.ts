import { DatabaseModule } from "@nest-boot/database";
import { type DynamicModule, Global, Module } from "@nestjs/common";

import { JwksController } from "./controllers/jwks.controller.js";
import { Jwk } from "./entities/jwk.entity.js";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from "./jwt.module-definition.js";
import { JwtService } from "./services/jwt.service.js";

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
    return {
      ...super.forRoot(options),
      controllers: [class extends JwksController {}],
    };
  }

  /**
   * Registers JWT signing using asynchronously resolved configuration.
   * @param options - Factory and dependency injection settings.
   * @returns Dynamic JWT module.
   */
  static override forRootAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    return {
      ...super.forRootAsync(options),
      controllers: [class extends JwksController {}],
    };
  }
}
