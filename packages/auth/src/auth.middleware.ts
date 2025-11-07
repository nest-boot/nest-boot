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
    const headers = new Headers();

    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach((v) => {
            headers.append(key, v);
          });
        } else {
          headers.set(key, value);
        }
      }
    });

    return await this.authService.auth.api.getSession({
      headers,
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const data = await this.getSession(req);

    if (data) {
      res.locals.user = await this.em.findOne(this.options.entities.user, {
        id: data.user.id,
      });

      res.locals.session = await this.em.findOne(
        this.options.entities.session,
        {
          token: data.session.token,
        },
      );
    }

    next();
  }
}
