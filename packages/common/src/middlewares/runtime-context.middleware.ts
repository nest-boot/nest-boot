import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response } from "express";

import { runtimeContextStorage } from "../runtime-context";
import { createRuntimeContext } from "../utils/create-runtime-context.util";

@Injectable()
export class RuntimeContextMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: () => void): Promise<void> {
    const ctx = createRuntimeContext();

    ctx.req = req;
    ctx.res = res;

    return runtimeContextStorage.run(ctx, () => next());
  }
}
