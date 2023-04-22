import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { from, lastValueFrom, type Observable } from "rxjs";

import { RequestContext } from "./request-context";

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly discoveryService: DiscoveryService) {}

  intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    if (context.getType() === "rpc") {
      const ctx = new RequestContext(this.discoveryService);

      return from(
        RequestContext.run<T>(
          ctx,
          async () => await lastValueFrom(next.handle())
        )
      );
    }

    return next.handle();
  }
}
