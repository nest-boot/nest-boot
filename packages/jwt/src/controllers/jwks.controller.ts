import { Controller, Get, Header, Inject } from "@nestjs/common";
import type { JSONWebKeySet } from "jose";

import type { JwtModuleOptions } from "../interfaces/jwt-module-options.interface.js";
import { MODULE_OPTIONS_TOKEN } from "../jwt.module-definition.js";
import { JwtService } from "../services/jwt.service.js";

const UNSUPPORTED_ENHANCER_METADATA_KEYS = [
  "__guards__",
  "__interceptors__",
  "__pipes__",
  "__exceptionFilters__",
] as const;

/** Publishes verification keys at the application's public JWKS URL. */
@Controller()
export class JwksController {
  constructor(
    private readonly jwt: JwtService,
    @Inject(MODULE_OPTIONS_TOKEN) options: JwtModuleOptions,
  ) {
    // Each JwtModule registration has its own controller subclass. Routes are
    // resolved during app initialization after controller instantiation,
    // including for async options, whereas Nest enhancers were already scanned.
    Controller(jwt.jwksPath)(new.target);
    if (options.jwks?.controllerDecorator) {
      options.jwks.controllerDecorator(new.target);
      if (
        UNSUPPORTED_ENHANCER_METADATA_KEYS.some((key) =>
          Reflect.hasOwnMetadata(key, new.target),
        )
      ) {
        throw new Error(
          "JWKS controllerDecorator only supports metadata decorators; Nest enhancers (@UseGuards, @UseInterceptors, @UsePipes, @UseFilters) are not supported",
        );
      }
    }
  }

  @Get()
  @Header("Cache-Control", "no-cache")
  getJwks(): Promise<JSONWebKeySet> {
    return this.jwt.getJwks();
  }
}
