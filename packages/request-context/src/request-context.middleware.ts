import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

import { RequestContext } from "./request-context";
import { REQUEST, RESPONSE } from "./request-context.constants";

/**
 * Middleware that creates a new RequestContext for each incoming HTTP request.
 * It also attaches the request and response objects to the context.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const ctx = new RequestContext({ type: "http" });
    ctx.set(REQUEST, req);
    ctx.set(RESPONSE, res);

    RequestContext.run(ctx, next);
  }
}
