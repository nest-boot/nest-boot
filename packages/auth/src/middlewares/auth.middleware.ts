import { Context } from "@nest-boot/common";
import { EntityManager } from "@mikro-orm/core";
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response } from "express";

import { PersonalAccessToken } from "../entities";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly entityManager: EntityManager) {}

  async use(req: Request, res: Response, next: () => void): Promise<void> {
    // 获取运行上下文
    const ctx = Context.get();

    // 查找访问令牌
    const accessTokenRepository =
      this.entityManager.getRepository(PersonalAccessToken);

    const accessToken = await accessTokenRepository.findOne({
      token: this.extractAccessToken(req),
    });

    if (accessToken != null) {
      const repository = this.entityManager.getRepository<NestBootAuth.User>(
        accessToken.entity
      );
      const entity = await repository.findOne(accessToken.entityId);

      // 设置访问令牌和用户到运行上下文
      if (entity != null) {
        ctx.accessToken = accessToken.token;
        ctx.user = entity;
      }
    }

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
