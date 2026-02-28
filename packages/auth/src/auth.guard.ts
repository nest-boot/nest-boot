import { RequestContext } from "@nest-boot/request-context";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { IS_PUBLIC_KEY } from "./auth.constants";
import { BaseSession } from "./entities/session.entity";

/**
 * Guard that enforces authentication on routes.
 *
 * @remarks
 * Allows access if the route is marked with {@link Public}, otherwise
 * requires a valid session in the request context.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  /** Creates a new AuthGuard instance.
   * @param reflector - NestJS reflector for reading route metadata
   */
  constructor(protected readonly reflector: Reflector) {}

  /**
   * Determines whether the current request is allowed to proceed.
   * @param context - The execution context of the current request
   * @returns `true` if the route is public or the user has a valid session
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
