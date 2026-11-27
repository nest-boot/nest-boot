import { Controller, Get, Header, VERSION_NEUTRAL } from "@nestjs/common";
import type { JSONWebKeySet } from "jose";

import { JwtService } from "../services/jwt.service.js";

/** Publishes verification keys at the application's public JWKS URL. */
@Controller({ version: VERSION_NEUTRAL })
export class JwksController {
  constructor(private readonly jwt: JwtService) {}

  @Get()
  @Header("Cache-Control", "no-cache")
  getJwks(): Promise<JSONWebKeySet> {
    return this.jwt.getJwks();
  }
}
