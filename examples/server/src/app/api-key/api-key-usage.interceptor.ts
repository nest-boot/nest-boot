import { RequestContext } from '@nest-boot/request-context';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { mergeMap, Observable } from 'rxjs';

import { ApiKey } from './api-key.entity.js';
import { ApiKeyService } from './api-key.service.js';

/**
 * 在请求完成后记录当前 API Key 的最近使用时间。
 */
@Injectable()
export class ApiKeyUsageInterceptor implements NestInterceptor {
  /**
   * 创建 API Key 使用记录拦截器。
   *
   * @param apiKeyService - API Key 业务服务。
   */
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * 在响应流完成前更新 API Key 使用时间。
   *
   * @param _context - Nest 当前执行上下文。
   * @param next - 后续调用处理器。
   * @returns 原始响应流。
   */
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (value: unknown) => {
        const apiKey = RequestContext.get(ApiKey);

        if (apiKey) {
          await this.apiKeyService.recordUsage(apiKey);
        }

        return value;
      }),
    );
  }
}
