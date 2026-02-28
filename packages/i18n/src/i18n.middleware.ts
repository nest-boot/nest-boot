import { RequestContext } from "@nest-boot/request-context";
import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import { type Handler, type Request, type Response } from "express";
import i18next from "i18next";
import middleware from "i18next-http-middleware";

import { I18N } from "./i18n.constants";
import { MODULE_OPTIONS_TOKEN } from "./i18n.module-definition";
import { I18nModuleOptions } from "./interfaces/i18n-module-options.interface";

/**
 * Middleware that detects the request language and stores the i18n instance in the request context.
 *
 * @remarks
 * Uses `i18next-http-middleware` for language detection from headers,
 * cookies, or query parameters, then makes the i18n instance available
 * via {@link RequestContext}.
 */
@Injectable()
export class I18nMiddleware implements NestMiddleware {
  /** i18next-http-middleware handler. @internal */
  private readonly handler: Handler;

  /** Creates a new I18nMiddleware instance.
   * @param options - i18next initialization and middleware options
   */
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    readonly options: I18nModuleOptions,
  ) {
    this.handler = middleware.handle(
      i18next as any,
      options,
    ) as unknown as Handler;
  }

  /**
   * Handles language detection and stores the i18n instance in the request context.
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next function
   */
  use(req: Request, res: Response, next: () => void): void {
    void this.handler(req, res, () => {
      RequestContext.set(I18N, req.i18n);
      next();
    });
  }
}
