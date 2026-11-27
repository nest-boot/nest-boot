import { Controller, Get, Header, Inject } from "@nestjs/common";
import type { JSONWebKeySet } from "jose";

import type { JwtModuleOptions } from "../interfaces/jwt-module-options.interface.js";
import { MODULE_OPTIONS_TOKEN } from "../jwt.module-definition.js";
import { JwtService } from "../services/jwt.service.js";

/** Publishes verification keys at the application's public JWKS URL. */
@Controller()
export class JwksController {
  constructor(
    private readonly jwt: JwtService,
    @Inject(MODULE_OPTIONS_TOKEN) options: JwtModuleOptions,
  ) {
    // Each JwtModule registration has its own controller class. The resolved
    // route is set before Nest scans controllers, including for async options.
    Controller(jwt.jwksPath)(new.target);
    options.jwks?.controllerDecorator?.(new.target);
  }

  @Get()
  @Header("Cache-Control", "no-cache")
  getJwks(): Promise<JSONWebKeySet> {
    return this.jwt.getJwks();
  }
}
