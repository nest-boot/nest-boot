import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Request } from "express";
import { Observable } from "rxjs";

import { RequestContext } from "./request-context";

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
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
