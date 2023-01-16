import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response } from "express";

import { RequestContext } from "./request-context";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: () => void): Promise<void> {
    const ctx = new RequestContext();
    ctx.set<Request>("request", req);
    ctx.set<Response>("response", res);

    RequestContext.run(ctx, () => {
      next();
    });
  }
}
