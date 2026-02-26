import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";

import { RequestContext } from "./request-context";
import { REQUEST, RESPONSE } from "./request-context.constants";

/**
 * Interceptor that attaches the request and response objects to the RequestContext.
 * This is used for HTTP requests.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() === "http") {
      const req = context.switchToHttp().getRequest();
      const res = context.switchToHttp().getResponse();

      RequestContext.set(REQUEST, req);
      RequestContext.set(RESPONSE, res);
    }

    return next.handle();
  }
}
