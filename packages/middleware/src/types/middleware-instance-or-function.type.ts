import { NestMiddleware } from "@nestjs/common";

import { MiddlewareFunction } from "./middleware-function.type.js";

/**
 * Middleware instance or function.
 */
export type MiddlewareInstanceOrFunction<TRequest = any, TResponse = any> =
  | NestMiddleware<TRequest, TResponse>
  | MiddlewareFunction<TRequest, TResponse>;
