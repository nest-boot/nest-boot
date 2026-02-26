import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Request } from "express";
import { Observable } from "rxjs";

import { Logger } from "./logger";

/**
 * Interceptor that adds route information to the logger context.
 * It logs the controller, handler, and route path.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  /**
   * Intercepts the request and adds route info to the logger.
   */
  intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    if (context.getType() === "http") {
      const req = context.switchToHttp().getRequest<Request>();

      this.logger.assign({
        route: {
          path: req.route.path,
          controller: context.getClass().name,
          handler: context.getHandler().name,
        },
      });
    }

    return next.handle();
  }
}
