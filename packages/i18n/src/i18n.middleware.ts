import { RequestContext } from "@nest-boot/request-context";
import {
  Inject,
  Injectable,
  type NestMiddleware,
  Optional,
} from "@nestjs/common";
import { type Handler, type Request, type Response } from "express";
import i18next, { type i18n } from "i18next";
import * as middleware from "i18next-http-middleware";

import { I18N } from "./i18n.constants.js";
import { MODULE_OPTIONS_TOKEN } from "./i18n.module-definition.js";
import type { I18nModuleOptions } from "./interfaces/i18n-module-options.interface.js";

/**
 * Middleware that detects the request language and stores the i18n instance in the request context.
 *
 * Uses `i18next-http-middleware` for language detection from headers,
 * cookies, or query parameters, then makes the i18n instance available
 * via {@link RequestContext}.
 */
@Injectable()
export class I18nMiddleware implements NestMiddleware {
  /**
   * i18next-http-middleware handler.
   * @internal
   */
  private readonly handler: Handler;

  /**
   * Creates a new I18nMiddleware instance.
   * @param options - i18next initialization and middleware options
   * @param i18nInstance - Configured i18next instance for the current module container
   */
  constructor(
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    readonly options: I18nModuleOptions = {},
    @Optional()
    @Inject(I18N)
    private readonly i18nInstance: i18n = i18next,
  ) {
    this.handler = middleware.handle(this.i18nInstance as any, options);
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
