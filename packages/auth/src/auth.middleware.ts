import { EntityManager } from "@mikro-orm/core";
import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition";
import { AuthService } from "./auth.service";
import { AuthModuleOptions } from "./auth-module-options.interface";

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

    res.locals.user = user;
    res.locals.session = session;

    next();
  }
}
