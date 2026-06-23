import { RequestContext } from "@nest-boot/request-context";
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { IS_PUBLIC_KEY } from "./auth.constants.js";
import { BaseSession } from "./entities/session.entity.js";

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
   * Determines whether the current route is marked as public.
   * @param context - The execution context of the current request
   * @returns True when authentication should be skipped
   */
  protected isPublic(context: ExecutionContext): boolean {
    return !!this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  /**
   * Determines whether the current request is allowed to proceed.
   * @param context - The execution context of the current request
   * @returns A NestJS guard activation result
   */
  canActivate(
    context: ExecutionContext,
  ): ReturnType<CanActivate["canActivate"]> {
    if (this.isPublic(context)) {
      return true;
    }

    return !!RequestContext.get(BaseSession);
  }
}
