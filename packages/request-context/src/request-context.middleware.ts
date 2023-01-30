import { Injectable, NestMiddleware } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { Request, Response } from "express";

import { RequestContext } from "./request-context";
import {
  REQUEST as CTX_REQUEST_TOKEN,
  RESPONSE as CTX_RESPONSE_TOKEN,
} from "./request-context.constants";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly moduleRef: ModuleRef) {}

  async use(req: Request, res: Response, next: () => void): Promise<void> {
    const ctx = new RequestContext(this.moduleRef);

    ctx.set<Request>(CTX_REQUEST_TOKEN, req);
    ctx.set<Response>(CTX_RESPONSE_TOKEN, res);

    RequestContext.run(ctx, () => {
      next();
    });
  }
}