import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response } from "express";

import { Context } from "../context";

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: () => void): Promise<void> {
    const ctx = new Context();
    ctx.set<Request>("request", req);
    ctx.set<Response>("response", res);

    return Context.run(ctx, () => next());
  }
}
