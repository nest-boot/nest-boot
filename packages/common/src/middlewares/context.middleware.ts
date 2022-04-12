import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import logger from "pino-http";

import { Context } from "../context";

const loggerMiddleware = logger({ genReqId: () => randomUUID() });

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: () => void): Promise<void> {
    loggerMiddleware(req, res);
    return Context.run({ req, res, logger: req.log }, () => next());
  }
}
