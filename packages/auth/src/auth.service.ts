import { Inject } from "@nestjs/common";
import { Auth } from "better-auth";

import { AUTH_TOKEN } from "./auth.constants";

export class AuthService {
  constructor(
    @Inject(AUTH_TOKEN)
    public readonly auth: Auth,
  ) {}
}
