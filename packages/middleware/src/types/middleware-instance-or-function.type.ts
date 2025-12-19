import { NestMiddleware } from "@nestjs/common/interfaces";

import { MiddlewareFunction } from "./middleware-function.type";

/**
 * Middleware instance or function.
 */
export type MiddlewareInstanceOrFunction<TRequest = any, TResponse = any> =
  | NestMiddleware<TRequest, TResponse>
  | MiddlewareFunction<TRequest, TResponse>;
