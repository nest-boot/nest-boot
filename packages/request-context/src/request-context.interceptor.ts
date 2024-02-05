import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";

import { RequestContext } from "./request-context";

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    if (RequestContext.isActive()) {
      return next.handle();
    }

    const ctx = new RequestContext();

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
