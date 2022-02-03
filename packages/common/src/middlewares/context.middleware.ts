import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response } from "express";

import { Context } from "../context";

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: () => void): Promise<void> {
    return Context.run({ req, res }, () => next());
  }
}
