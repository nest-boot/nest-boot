import { RequestContext } from "@nest-boot/request-context";
import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import { Handler, Request, Response } from "express";
import i18next from "i18next";
import middleware from "i18next-http-middleware";

import { I18N } from "./i18n.constants";
import { MODULE_OPTIONS_TOKEN } from "./i18n.module-definition";
import { I18nModuleOptions } from "./interfaces/i18n-module-options.interface";

@Injectable()
export class I18nMiddleware implements NestMiddleware {
  private readonly handler: Handler;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) readonly options: I18nModuleOptions
  ) {
    this.handler = middleware.handle(i18next as any, options);
  }

  async use(req: Request, res: Response, next: () => void): Promise<void> {
    this.handler(req, res, () => {
      RequestContext.set(I18N, req.i18n);
      next();
    });
  }
}
