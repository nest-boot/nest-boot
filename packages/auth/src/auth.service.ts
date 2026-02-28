import { Inject } from "@nestjs/common";
import { Auth } from "better-auth";

import { AUTH_TOKEN } from "./auth.constants";

/** Service exposing the better-auth API to the application. */
export class AuthService {
  /**
   * Creates a new AuthService instance.
   * @param auth - The better-auth instance
   */
  constructor(
    @Inject(AUTH_TOKEN)
    /** @internal */
    private readonly auth: Auth,
  ) {}

  /** The better-auth API interface for session and user management. */
  get api() {
    return this.auth.api;
  }
}
