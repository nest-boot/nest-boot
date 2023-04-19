import { Injectable, type NestMiddleware } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { type Request, type Response } from "express";

import { RequestContext } from "./request-context";
import {
  REQUEST as CTX_REQUEST_TOKEN,
  RESPONSE as CTX_RESPONSE_TOKEN,
} from "./request-context.constants";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly discoveryService: DiscoveryService) {}

  async use(req: Request, res: Response, next: () => void): Promise<void> {
    const ctx = new RequestContext(this.discoveryService);

    ctx.set<Request>(CTX_REQUEST_TOKEN, req);
    ctx.set<Response>(CTX_RESPONSE_TOKEN, res);

    void RequestContext.run(ctx, () => { next(); });
  }
}
