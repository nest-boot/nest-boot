import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Request } from "express";
import { Observable } from "rxjs";

import { RequestContext } from "./request-context";

/**
 * NestJS interceptor that creates request context for HTTP and GraphQL requests.
 *
 * This interceptor serves as a fallback for cases where the middleware doesn't
 * run (e.g., GraphQL resolvers). It:
 * - Creates a new RequestContext if one doesn't already exist
 * - Uses the `x-request-id` header as the context ID if provided
 * - Supports both HTTP and GraphQL execution contexts
 *
 * The interceptor is automatically registered by RequestContextModule.
 *
 * @example
 * The interceptor is typically used automatically, but can be applied manually:
 * ```typescript
 * import { Controller, UseInterceptors } from '@nestjs/common';
 * import { RequestContextInterceptor } from '@nest-boot/request-context';
 *
 * @Controller()
 * @UseInterceptors(RequestContextInterceptor)
 * export class MyController {}
 * ```
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  /**
   * Intercepts the request and wraps execution in a request context.
   *
   * @typeParam T - The type of the response
   * @param executionContext - The NestJS execution context
   * @param next - The call handler for the next interceptor or handler
   * @returns An observable of the response
   */
  intercept<T>(
    executionContext: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T> {
    if (
      RequestContext.isActive() ||
      !["http", "graphql"].includes(executionContext.getType())
    ) {
      return next.handle();
    }

    const id = (
      executionContext.switchToHttp().getRequest<Request>() ??
      executionContext.getArgByIndex<{ req: Request }>(2).req
    )?.get?.("x-request-id");

    const ctx = new RequestContext({
      id,
      type: "http",
    });

    return new Observable((subscriber) => {
      void RequestContext.run(ctx, () => {
        try {
          next
            .handle()
            .pipe()
            .subscribe({
              next: (res) => {
                subscriber.next(res);
              },
              error: (err) => {
                subscriber.error(err);
              },
              complete: () => {
                subscriber.complete();
              },
            });
        } catch (err) {
          subscriber.error(err);
        }
      });
    });
  }
}
