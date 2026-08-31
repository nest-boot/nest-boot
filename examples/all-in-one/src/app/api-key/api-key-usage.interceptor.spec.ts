import { RequestContext } from '@nest-boot/request-context';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { Mocked } from 'vitest';

import { ApiKey } from './api-key.entity.js';
import { ApiKeyService } from './api-key.service.js';
import { ApiKeyUsageInterceptor } from './api-key-usage.interceptor.js';

describe('ApiKeyUsageInterceptor', () => {
  it('records usage after a request with API key context succeeds', async () => {
    const apiKey = { id: 'api_key_1' } as ApiKey;
    const { interceptor, apiKeyService } = createInterceptor();
    const handler = createHandler(of({ ok: true }));

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      RequestContext.set(ApiKey, apiKey);

      await expect(
        lastValueFrom(interceptor.intercept({} as ExecutionContext, handler)),
      ).resolves.toEqual({ ok: true });
    });

    expect(apiKeyService.recordUsage).toHaveBeenCalledWith(apiKey);
  });

  it('does nothing when there is no API key context', async () => {
    const { interceptor, apiKeyService } = createInterceptor();
    const handler = createHandler(of({ ok: true }));

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      await expect(
        lastValueFrom(interceptor.intercept({} as ExecutionContext, handler)),
      ).resolves.toEqual({ ok: true });
    });

    expect(apiKeyService.recordUsage).not.toHaveBeenCalled();
  });

  it('does not record usage when the handler fails', async () => {
    const apiKey = { id: 'api_key_1' } as ApiKey;
    const { interceptor, apiKeyService } = createInterceptor();
    const error = new Error('boom');
    const handler = createHandler(throwError(() => error));

    await RequestContext.run(new RequestContext({ type: 'http' }), async () => {
      RequestContext.set(ApiKey, apiKey);

      await expect(
        lastValueFrom(interceptor.intercept({} as ExecutionContext, handler)),
      ).rejects.toBe(error);
    });

    expect(apiKeyService.recordUsage).not.toHaveBeenCalled();
  });
});

function createInterceptor() {
  const apiKeyService = {
    recordUsage: vi.fn(async (apiKey: ApiKey) => apiKey),
  } as unknown as Mocked<ApiKeyService>;

  return {
    apiKeyService,
    interceptor: new ApiKeyUsageInterceptor(apiKeyService),
  };
}

function createHandler(
  observable: CallHandler['handle'] extends () => infer T ? T : never,
) {
  return {
    handle: vi.fn(() => observable),
  } as CallHandler;
}
