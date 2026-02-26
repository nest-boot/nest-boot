import { NextFunction, Request, Response } from "express";

import { RequestContext } from "./request-context";

export type MiddlewareInstanceOrFunction =
  | ((req: Request, res: Response, next: NextFunction) => void)
  | ((ctx: RequestContext, next: () => Promise<void>) => Promise<void>);

export interface RequestContextCreateOptions {
  type?: string;
}
