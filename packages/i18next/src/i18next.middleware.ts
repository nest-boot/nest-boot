import { RequestContext } from "@nest-boot/request-context";
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Handler, Request, Response } from "express";
import { i18n as I18Next } from "i18next";
import middleware from "i18next-http-middleware";

import { InjectI18next } from "./decorators";

@Injectable()
export class I18NextMiddleware implements NestMiddleware {
  readonly i18nextMiddleware: Handler;

  constructor(@InjectI18next() readonly i18next: I18Next) {
    this.i18nextMiddleware = middleware.handle(this.i18next);
  }

  async use(req: Request, res: Response, next: () => void): Promise<void> {
    this.i18nextMiddleware(req, res, () => {
      RequestContext.set("i18n", (req as Request & { i18n: I18Next }).i18n);
      next();
    });
  }
}
