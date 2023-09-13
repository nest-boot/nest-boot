import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { from, lastValueFrom, type Observable } from "rxjs";

import { RequestContext } from "./request-context";

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    if (context.getType() === "rpc") {
      const ctx = new RequestContext();

      return from(
        RequestContext.run<T>(
          ctx,
          async () => await lastValueFrom(next.handle()),
        ),
      );
    }

    return next.handle();
  }
}
