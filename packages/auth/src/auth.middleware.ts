import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { Inject, Injectable, NestMiddleware, Scope } from "@nestjs/common";
import { Request, Response } from "express";

import { AUTH_ACCESS_TOKEN, AUTH_ENTITY } from "./auth.constants";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition";
import { AuthService } from "./auth.service";
import { AccessTokenInterface, AuthModuleOptions } from "./interfaces";

@Injectable({ scope: Scope.REQUEST })
export class AuthMiddleware implements NestMiddleware {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly entityManager: EntityManager,
    private readonly authService: AuthService
  ) {}

  async use(req: Request, res: Response, next: () => void): Promise<void> {
    const accessTokenString = this.extractAccessToken(req);

    if (accessTokenString !== null) {
      const accessToken = await this.authService.getToken(accessTokenString);

      if (accessToken !== null) {
        RequestContext.set<AccessTokenInterface>(
          AUTH_ACCESS_TOKEN,
          accessToken
        );

        const entity = await this.entityManager
          .getRepository(accessToken.entityName)
          .findOne(accessToken.entityId);

        // 设置访问令牌和用户到运行上下文
        if (entity !== null) {
          RequestContext.set(AUTH_ENTITY, entity);
        }
      }
    }

    next();
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
