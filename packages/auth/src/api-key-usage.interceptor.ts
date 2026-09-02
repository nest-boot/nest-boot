import { RequestContext } from "@nest-boot/request-context";
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { mergeMap, type Observable } from "rxjs";

import { ApiKeyService } from "./api-key.service.js";
import { CURRENT_API_KEY } from "./auth.constants.js";
import type { BaseApiKey } from "./entities/index.js";

/** Records successful requests authenticated with an API key. */
@Injectable()
export class ApiKeyUsageInterceptor implements NestInterceptor {
  /** Creates the API-key usage interceptor. */
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /** Updates the usage timestamp after a successful handler result. */
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (value: unknown) => {
        const apiKey = RequestContext.get<BaseApiKey>(CURRENT_API_KEY);

        if (apiKey) {
          await this.apiKeyService.recordUsage(apiKey);
        }

        return value;
      }),
    );
  }
}
