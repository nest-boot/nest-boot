import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { mergeMap, type Observable } from "rxjs";

import { ApiKeyAuthenticationService } from "./infrastructure/api-key-authentication.service.js";
import { getCurrentApiKey } from "./utils/get-current-api-key.util.js";

/** Records successful requests authenticated with an API key. */
@Injectable()
export class ApiKeyUsageInterceptor implements NestInterceptor {
  /** Creates the API-key usage interceptor. */
  constructor(private readonly apiKeyService: ApiKeyAuthenticationService) {}

  /** Updates the usage timestamp after a successful handler result. */
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const apiKey = getCurrentApiKey();
    const recordUsage = apiKey ? this.apiKeyService.captureUsage(apiKey) : null;
    return next.handle().pipe(
      mergeMap(async (value: unknown) => {
        if (recordUsage) await recordUsage();
        return value;
      }),
    );
  }
}
