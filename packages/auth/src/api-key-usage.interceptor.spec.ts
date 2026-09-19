/* eslint-disable @typescript-eslint/unbound-method */
import { RequestContext } from "@nest-boot/request-context";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { defer, lastValueFrom, of, throwError } from "rxjs";
import type { Mocked } from "vitest";

import { ApiKeyUsageInterceptor } from "./api-key-usage.interceptor.js";
import { API_KEY } from "./auth.constants.js";
import { WorkspaceApiKey as BaseApiKey } from "./entities/workspace-api-key.entity.js";
import type { ApiKeyAuthenticationService } from "./infrastructure/api-key-authentication.service.js";

describe("ApiKeyUsageInterceptor", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records the original key after the handler replaces request identity", async () => {
    const apiKey = new BaseApiKey();
    const recordUsage = vi.fn().mockResolvedValue(apiKey);
    const service = {
      captureUsage: vi.fn(() => recordUsage),
      recordUsage,
    } as unknown as Mocked<ApiKeyAuthenticationService>;
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(API_KEY, apiKey);
      const stream = new ApiKeyUsageInterceptor(service).intercept(
        {} as ExecutionContext,
        {
          handle: () =>
            defer(() => {
              RequestContext.set(API_KEY, null);
              return of("new identity");
            }),
        },
      );
      await expect(lastValueFrom(stream)).resolves.toBe("new identity");
      expect(recordUsage).toHaveBeenCalledOnce();
    });
  });

  it("records usage only after a successful API-key request", async () => {
    const apiKey = { id: "api-key-1" } as BaseApiKey;
    const recordUsage = vi.fn(() => Promise.resolve(apiKey));
    const service = {
      captureUsage: vi.fn(() => recordUsage),
    } as unknown as Mocked<ApiKeyAuthenticationService>;
    const interceptor = new ApiKeyUsageInterceptor(service);
    vi.spyOn(RequestContext, "isActive").mockReturnValue(true);
    vi.spyOn(RequestContext, "get").mockImplementation((token) =>
      token === API_KEY ? apiKey : undefined,
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
    expect(service.captureUsage).toHaveBeenCalledWith(apiKey);
    expect(recordUsage).toHaveBeenCalledOnce();
  });

  it("does not record requests without an API key or failed handlers", async () => {
    const recordUsage = vi.fn();
    const service = {
      captureUsage: vi.fn(() => recordUsage),
    } as unknown as Mocked<ApiKeyAuthenticationService>;
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
    expect(service.captureUsage).not.toHaveBeenCalled();
    vi.spyOn(RequestContext, "isActive").mockReturnValue(true);
    vi.spyOn(RequestContext, "get").mockReturnValue(new BaseApiKey());
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
    expect(service.captureUsage).toHaveBeenCalledOnce();
    expect(recordUsage).not.toHaveBeenCalled();
  });
});
