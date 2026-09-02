import type { IncomingMessage, ServerResponse } from "node:http";

import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import { type Auth } from "better-auth";
import { toNodeHandler } from "better-auth/node";

import { AUTH_TOKEN } from "./auth.constants.js";

/** Mounts the internal Better Auth HTTP handler. @internal */
@Injectable()
export class AuthHandlerMiddleware implements NestMiddleware<
  IncomingMessage,
  ServerResponse
> {
  private readonly handler: ReturnType<typeof toNodeHandler>;

  /** Creates the HTTP handler from the dependency-injected auth instance. */
  constructor(@Inject(AUTH_TOKEN) auth: unknown) {
    this.handler = toNodeHandler(auth as Auth);
  }

  /** Delegates an incoming auth endpoint request to Better Auth. */
  use(req: IncomingMessage, res: ServerResponse): Promise<void> {
    return this.handler(req, res);
  }
}
