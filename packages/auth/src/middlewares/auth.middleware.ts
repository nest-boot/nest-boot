import { Context } from "@nest-boot/common";
import { EntityManager } from "@mikro-orm/core";
import { Injectable, NestMiddleware, Scope } from "@nestjs/common";
import { Request, Response } from "express";

import { PersonalAccessToken } from "../entities";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly entityManager: EntityManager) {}

  async use(req: Request, res: Response, next: () => void): Promise<void> {
    return next();
  }

  private extractAccessToken(req: Request): string | null {
    let accessToken: string | null = null;

    const authorizationHeader = req.get("Authorization");
    if (typeof authorizationHeader === "string") {
      const matched = authorizationHeader.match(/[Bb]earer\s+(.+)$/i);

      if (matched !== null) {
        accessToken = matched[1];
      }
    }

    // 从会话中提取访问令牌
    if (typeof accessToken === "string" && accessToken !== "") {
      accessToken = req.cookies.access_token;
    }

    return accessToken;
  }
}
