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
 * - Categorizes fallback contexts as `"http"` to match contexts created by
 *   the request middleware; NestJS may still report the resolver execution
 *   context type as `"graphql"`
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
      let resolveTermination!: () => void;
      let rejectTermination!: (reason: unknown) => void;
      let terminated = false;
      const termination = new Promise<void>((resolve, reject) => {
        resolveTermination = () => {
          if (!terminated) {
            terminated = true;
            resolve();
          }
        };
        rejectTermination = (reason) => {
          if (!terminated) {
            terminated = true;
            // RxJS permits arbitrary error values and they must be forwarded intact.
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            reject(reason);
          }
        };
      });
      let subscribeToSource!: (source: Observable<T>) => void;
      const sourceSubscription = new Observable<T>((sourceSubscriber) => {
        subscribeToSource = (source) => {
          source.subscribe(sourceSubscriber);
        };
      }).subscribe({
        next: (res) => {
          subscriber.next(res);
        },
        error: (err: unknown) => {
          rejectTermination(err);
        },
        complete: () => {
          resolveTermination();
        },
      });

      subscriber.add(sourceSubscription);
      subscriber.add(resolveTermination);

      void RequestContext.run(ctx, async () => {
        if (subscriber.closed) {
          return;
        }

        try {
          const source = next.handle();
          if (!subscriber.closed) {
            subscribeToSource(source);
          }
        } catch (err) {
          rejectTermination(err);
        }

        await termination;
      }).then(
        () => {
          if (!subscriber.closed) {
            subscriber.complete();
          }
        },
        (err: unknown) => {
          if (!subscriber.closed) {
            subscriber.error(err);
          }
        },
      );
    });
  }
}
