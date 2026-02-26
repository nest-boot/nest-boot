import { RequestContext } from "@nest-boot/request-context";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { IS_PUBLIC_KEY } from "./auth.constants";
import { BaseSession } from "./entities/session.entity";

/**
 * Guard that checks if the request is authenticated.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(protected readonly reflector: Reflector) {}

  /**
   * Determines if the current request can proceed.
   * Checks for the public metadata or if a session exists in the request context.
   *
   * @param context - The execution context.
   * @returns A boolean indicating whether the request is allowed.
   */
  canActivate(context: ExecutionContext): boolean {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    return !!RequestContext.get(BaseSession);
  }
}
