import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { Inject, Injectable, NestMiddleware, Type } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition";
import { AuthService } from "./auth.service";
import { AuthModuleOptions } from "./auth-module-options.interface";
import { BaseSession, BaseUser } from "./entities";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly authService: AuthService,
    private readonly em: EntityManager,
  ) {}
  private async getSession(req: Request) {
    return await this.authService.api.getSession({
      headers: Object.entries(req.headers).reduce((headers, [key, value]) => {
        if (value) {
          if (Array.isArray(value)) {
            for (const item of value) {
              headers.append(key, item);
            }
          } else {
            headers.append(key, value);
          }
        }
        return headers;
      }, new Headers()),
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const data = await this.getSession(req);

    if (!data) {
      next();
      return;
    }

    const [user, session] = await Promise.all([
      this.em.findOne(this.options.entities.user, {
        id: data.user.id,
      }),
      this.em.findOne(this.options.entities.session, {
        token: data.session.token,
      }),
    ]);

    if (user && session) {
      RequestContext.set(BaseUser, user);
      RequestContext.set(BaseSession, session);

      RequestContext.set(this.options.entities.user as Type<BaseUser>, user);
      RequestContext.set(
        this.options.entities.session as Type<BaseSession>,
        session,
      );

      await this.options.onAuthenticated?.();
    }

    next();
  }
}
