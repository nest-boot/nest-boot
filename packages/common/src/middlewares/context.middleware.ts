import { randomUUID } from "crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response } from "express";
import { Logger } from "pino";
import logger from "pino-http";

import { Context } from "../context";

const loggerMiddleware = logger({ genReqId: () => randomUUID() });

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: () => void): Promise<void> {
    loggerMiddleware(req, res);

    const ctx = new Context();
    ctx.set<Request>("request", req);
    ctx.set<Response>("response", res);
    ctx.set<Logger>("logger", req.log);

    return Context.run(ctx, () => next());
  }
}
