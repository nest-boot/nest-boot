import { Injectable, type NestMiddleware } from "@nestjs/common";
import { type NextFunction, type Request, type Response } from "express";

import { RequestContext } from "./request-context";
import {
  REQUEST as CTX_REQUEST_TOKEN,
  RESPONSE as CTX_RESPONSE_TOKEN,
} from "./request-context.constants";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const ctx = new RequestContext();

    ctx.set<Request>(CTX_REQUEST_TOKEN, req);
    ctx.set<Response>(CTX_RESPONSE_TOKEN, res);

    await RequestContext.run(ctx, () => {
      next();
    });
  }
}
