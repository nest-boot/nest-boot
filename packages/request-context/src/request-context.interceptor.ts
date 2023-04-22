import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { from,lastValueFrom, type Observable } from "rxjs";

import { RequestContext } from "./request-context";

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly discoveryService: DiscoveryService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>
  ): Observable<any> | Promise<Observable<any>> {
    if (context.getType() === "rpc") {
      const ctx = new RequestContext(this.discoveryService);
      return from(RequestContext.run(ctx, async () => await lastValueFrom(next.handle())));
    }

    return next.handle();
  }
}
