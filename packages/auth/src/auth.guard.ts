import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Response } from "express";

import { IS_PUBLIC_KEY } from "./auth.constants";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(protected readonly reflector: Reflector) {}

  async getResponse(context: ExecutionContext): Promise<Response> {
    if (context.getType<"graphql">() === "graphql") {
      return context.getArgByIndex(2).req.res;
    }

    return await context.switchToHttp().getResponse();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const res = await this.getResponse(context);
    return !!res.locals.session;
  }
}
