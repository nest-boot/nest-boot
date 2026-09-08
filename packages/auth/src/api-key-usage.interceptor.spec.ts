/* eslint-disable @typescript-eslint/unbound-method */
import { RequestContext } from "@nest-boot/request-context";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of, throwError } from "rxjs";
import type { Mocked } from "vitest";

import type { ApiKeyService } from "./api-key.service.js";
import { ApiKeyUsageInterceptor } from "./api-key-usage.interceptor.js";
import { BaseApiKey } from "./entities/index.js";

describe("ApiKeyUsageInterceptor", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records usage only after a successful API-key request", async () => {
    const apiKey = { id: "api-key-1" } as BaseApiKey;
    const service = {
      recordUsage: vi.fn(() => Promise.resolve(apiKey)),
    } as unknown as Mocked<ApiKeyService>;
    const interceptor = new ApiKeyUsageInterceptor(service);
    vi.spyOn(RequestContext, "get").mockImplementation((token) =>
      token === BaseApiKey ? apiKey : undefined,
    );

    await expect(
      lastValueFrom(
        interceptor.intercept(
          {} as ExecutionContext,
          {
            handle: () => of("ok"),
          } as CallHandler,
        ),
      ),
    ).resolves.toBe("ok");
    expect(service.recordUsage).toHaveBeenCalledWith(apiKey);
  });

  it("does not record requests without an API key or failed handlers", async () => {
    const service = {
      recordUsage: vi.fn(),
    } as unknown as Mocked<ApiKeyService>;
    const interceptor = new ApiKeyUsageInterceptor(service);
    vi.spyOn(RequestContext, "get").mockReturnValue(undefined);

    await lastValueFrom(
      interceptor.intercept(
        {} as ExecutionContext,
        {
          handle: () => of("ok"),
        } as CallHandler,
      ),
    );
    await expect(
      lastValueFrom(
        interceptor.intercept(
          {} as ExecutionContext,
          {
            handle: () => throwError(() => new Error("failed")),
          } as CallHandler,
        ),
      ),
    ).rejects.toThrow("failed");
    expect(service.recordUsage).not.toHaveBeenCalled();
  });
});
