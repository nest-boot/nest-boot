import { Injectable, type NestMiddleware } from "@nestjs/common";
import { type NextFunction, type Request, type Response } from "express";

import { RequestContext } from "./request-context";
import {
  REQUEST as CTX_REQUEST_TOKEN,
  RESPONSE as CTX_RESPONSE_TOKEN,
} from "./request-context.constants";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  readonly use: NestMiddleware["use"];

  constructor() {
    this.use = this.handle.bind(this);
  }

  private async handle(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
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
