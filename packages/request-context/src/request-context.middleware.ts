import { Injectable, type NestMiddleware } from "@nestjs/common";
import { type NextFunction, type Request, type Response } from "express";

import { RequestContext } from "./request-context";
import {
  REQUEST as CTX_REQUEST_TOKEN,
  RESPONSE as CTX_RESPONSE_TOKEN,
} from "./request-context.constants";

/**
 * Express middleware that creates and manages request context for HTTP requests.
 *
 * This middleware:
 * - Creates a new RequestContext for each incoming HTTP request
 * - Uses the `x-request-id` header as the context ID if provided
 * - Stores the Express request and response objects in the context
 * - Maintains the context throughout the request lifecycle
 *
 * The middleware is automatically applied by RequestContextModule to all routes.
 *
 * @example Accessing request/response from context
 * ```typescript
 * import { RequestContext, REQUEST, RESPONSE } from '@nest-boot/request-context';
 * import { Request, Response } from 'express';
 *
 * const req = RequestContext.get<Request>(REQUEST);
 * const res = RequestContext.get<Response>(RESPONSE);
 * ```
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  /**
   * Processes an incoming HTTP request and establishes request context.
   *
   * @param req - The Express request object
   * @param res - The Express response object
   * @param next - The next middleware function
   */
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (RequestContext.isActive()) {
      next();
      return;
    }

    const ctx = new RequestContext({
      id: req.get("x-request-id"),
      type: "http",
    });

    ctx.set<Request>(CTX_REQUEST_TOKEN, req);
    ctx.set<Response>(CTX_RESPONSE_TOKEN, res);

    await RequestContext.run(ctx, () => {
      return new Promise<void>((resolve) => {
        const onResponseComplete = () => {
          res.removeListener("close", onResponseComplete);
          res.removeListener("finish", onResponseComplete);
          res.removeListener("error", onResponseComplete);
          resolve();
        };

        res.on("finish", onResponseComplete);
        res.on("close", onResponseComplete);
        res.on("error", onResponseComplete);

        next();
      });
    });
  }
}
