import { EntityManager } from "@mikro-orm/core";
import { Context } from "@nest-boot/common";
import { Inject, Injectable, NestMiddleware, Scope } from "@nestjs/common";
import { Request, Response } from "express";

import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition";
import { AuthService } from "./auth.service";
import { AuthModuleOptions, AuthPayload } from "./interfaces";

@Injectable({ scope: Scope.REQUEST })
export class AuthMiddleware implements NestMiddleware {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly entityManager: EntityManager,
    private readonly authService: AuthService
  ) {}

  async use(req: Request, res: Response, next: () => void): Promise<void> {
    const accessToken = this.extractAccessToken(req);

    if (accessToken !== null) {
      const personalAccessToken = await this.authService.getToken(accessToken);

      if (personalAccessToken !== null) {
        const entity = await this.entityManager
          .getRepository(personalAccessToken.entityName)
          .findOne(personalAccessToken.entityId);

        // 设置访问令牌和用户到运行上下文
        if (entity !== null) {
          Context.set<AuthPayload>("auth", { entity, personalAccessToken });
        }
      }
    }

    return next();
  }

  private extractAccessToken(req: Request): string | null {
    const authorizationHeader = req.get("authorization");
    if (typeof authorizationHeader === "string") {
      const matched = authorizationHeader.match(/(\S+)\s+(\S+)/);

      if (matched !== null && matched[1].toLowerCase() === "bearer") {
        return matched[2];
      }
    }

    if (typeof req.cookies?.token === "string") {
      return req.cookies.token;
    }

    return null;
  }
}
