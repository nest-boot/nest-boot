import { Inject } from "@nestjs/common";
import { Auth } from "better-auth";

import { AUTH_TOKEN } from "./auth.constants";

/**
 * Service to access Better Auth API.
 */
export class AuthService {
  constructor(
    @Inject(AUTH_TOKEN)
    private readonly auth: Auth,
  ) {}

  /**
   * Returns the Better Auth API instance.
   */
  get api() {
    return this.auth.api;
  }
}
