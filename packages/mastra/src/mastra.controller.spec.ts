import { Readable } from "node:stream";

import type { Mastra } from "@mastra/core/mastra";
import type {
  AuthService,
  CustomRouteService,
  MastraModuleOptions as MastraCoreModuleOptions,
  MastraThrottleGuard,
  RequestContextService,
  RouteHandlerService,
} from "@mastra/nestjs";
import { NotFoundException, PayloadTooLargeException } from "@nestjs/common";
import { ApplicationConfig } from "@nestjs/core";
import type { Request, Response } from "express";

import { MastraController } from "./mastra.controller.js";
import type { MastraModuleOptions } from "./mastra.module-definition.js";

/**
 * Builds a minimal Express-like request object for `MastraController` unit tests.
 * @param overrides - Partial request properties and custom header overrides
 * @returns Mocked Express request
 */
function createMockRequest(
  overrides: Partial<Request> & {
    mastraRawBodySize?: number;
    headerValues?: Record<string, string | undefined>;
  } = {},
): Request & { mastraRawBodySize?: number } {
  const { headerValues = {}, ...rest } = overrides;
  const headers = rest.headers ?? {};
  const req = {
    method: "GET",
    path: "/api/mastra/agents",
    url: "/api/mastra/agents",
    originalUrl: "/api/mastra/agents",
    protocol: "http",
    headers,
    query: {},
    body: undefined,
    get: (name: string) => {
      const lower = name.toLowerCase();
      if (lower in headerValues) {
        return headerValues[lower];
      }
      const value = headers[lower];
      return Array.isArray(value) ? value.join(", ") : value;
    },
    ...rest,
  };
  return req as unknown as Request & { mastraRawBodySize?: number };
}

interface ControllerHarnessOptions {
  moduleOptions?: MastraModuleOptions;
  coreOptions?: Partial<MastraCoreModuleOptions>;
  globalPrefix?: string;
  authEnabled?: boolean;
  authUser?: unknown;
}

/**
 * Creates a `MastraController` instance wired with mocked `@mastra/nestjs` dependencies.
 * @param options - Harness configuration overrides
 * @returns Controller instance and spy handles
 */
function createControllerHarness(options: ControllerHarnessOptions = {}) {
  const routeHandler = {
    matchRoute: vi.fn(),
    executeHandler: vi.fn(),
    enforceRoutePermission: vi.fn().mockResolvedValue(undefined),
    enforceRouteFGA: vi.fn().mockResolvedValue(undefined),
  };
  const requestContext = {
    requestContext: new Map<string, unknown>(),
    abortSignal: new AbortController().signal,
    setUser: vi.fn(),
  };
  const customRoutes = {
    handle: vi.fn().mockResolvedValue(false),
  };
  const authService = {
    isEnabled: vi.fn().mockReturnValue(options.authEnabled ?? false),
    authenticate: vi.fn().mockResolvedValue(options.authUser),
  };
  const throttleGuard = {
    getRateLimitSettings: vi
      .fn()
      .mockReturnValue({ limit: 60, windowMs: 1000 }),
    checkLimit: vi.fn().mockResolvedValue(undefined),
  };

  let applicationConfig: ApplicationConfig | undefined;
  if (options.globalPrefix !== undefined) {
    applicationConfig = new ApplicationConfig();
    applicationConfig.setGlobalPrefix(options.globalPrefix);
  }

  const controller = new MastraController(
    options.moduleOptions ?? {},
    {
      mastra: {} as Mastra,
      prefix: "/api/mastra",
      ...options.coreOptions,
    },
    routeHandler as unknown as RouteHandlerService,
    requestContext as unknown as RequestContextService,
    customRoutes as unknown as CustomRouteService,
    authService as unknown as AuthService,
    throttleGuard as unknown as MastraThrottleGuard,
    applicationConfig,
  );

  return {
    controller,
    routeHandler,
    requestContext,
    customRoutes,
    authService,
    throttleGuard,
    res: {} as Response,
  };
}

describe("MastraController", () => {
  it("throws NotFoundException when API is disabled via module options", async () => {
    const { controller, res } = createControllerHarness({
      moduleOptions: { api: false },
    });

    await expect(
      controller.handleRequest(createMockRequest(), res),
    ).rejects.toThrow(NotFoundException);
  });

  it("matches standard routes across default, custom, global, excluded, and empty prefixes", async () => {
    const route = {
      method: "GET",
      path: "/agents",
      requiresAuth: false,
      authTransport: "cookie",
    };

    const withGlobal = createControllerHarness({
      globalPrefix: "/v1/",
      coreOptions: { prefix: "api/mastra/" },
    });
    withGlobal.routeHandler.matchRoute.mockReturnValue({
      route,
      pathParams: { id: "writer" },
    });
    withGlobal.routeHandler.executeHandler.mockResolvedValue({ ok: true });

    const res1 = await withGlobal.controller.handleRequest(
      createMockRequest({
        path: "/v1/api/mastra/agents",
        originalUrl:
          "/v1/api/mastra/agents?page=1&requestContext=ignored&__proto__=bad",
        headers: {
          host: "example.com:3000",
          "x-multi": ["a", "b"],
          "x-empty": undefined,
        },
        query: {
          page: "1",
          requestContext: "ignored",
          constructor: "ignored",
        },
      }),
      withGlobal.res,
    );

    expect(res1).toEqual({ ok: true });
    expect(withGlobal.routeHandler.matchRoute).toHaveBeenCalledWith(
      "GET",
      "/agents",
    );
    const executeArgs = withGlobal.routeHandler.executeHandler.mock
      .calls[0]?.[1] as {
      pathParams: Record<string, string>;
      queryParams: Record<string, unknown>;
      body: unknown;
      request: globalThis.Request;
    };
    expect(executeArgs.pathParams).toEqual({ id: "writer" });
    expect(executeArgs.queryParams).toEqual({ page: "1" });
    expect(executeArgs.body).toBeUndefined();
    expect(executeArgs.request.url).toBe(
      "http://example.com:3000/v1/api/mastra/agents?page=1&requestContext=ignored&__proto__=bad",
    );
    expect(executeArgs.request.headers.get("x-multi")).toBe("a, b");

    // Global prefix configured, but route excluded from global prefix -> falls back to api prefix
    withGlobal.routeHandler.matchRoute.mockClear();
    await withGlobal.controller.handleRequest(
      createMockRequest({ path: "/api/mastra" }),
      withGlobal.res,
    );
    expect(withGlobal.routeHandler.matchRoute).toHaveBeenCalledWith("GET", "/");

    // Empty prefix accepts any path directly
    const emptyPrefix = createControllerHarness({
      coreOptions: { prefix: "" },
    });
    emptyPrefix.routeHandler.matchRoute.mockReturnValue({
      route,
      pathParams: {},
    });
    emptyPrefix.routeHandler.executeHandler.mockResolvedValue({ ok: true });
    await emptyPrefix.controller.handleRequest(
      createMockRequest({
        path: "",
        protocol: "",
        originalUrl: "",
        url: "/agents",
        headerValues: { host: "" },
      }),
      emptyPrefix.res,
    );
    expect(emptyPrefix.routeHandler.matchRoute).toHaveBeenCalledWith(
      "GET",
      "/",
    );
    const fallbackReq = emptyPrefix.routeHandler.executeHandler.mock
      .calls[0]?.[1] as { request: globalThis.Request };
    expect(fallbackReq.request.url).toBe("http://localhost/agents");

    // Outside prefix or double-slash path falls through to 404
    const outside = createControllerHarness();
    await expect(
      outside.controller.handleRequest(
        createMockRequest({ path: "/other/agents" }),
        outside.res,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(outside.routeHandler.matchRoute).not.toHaveBeenCalled();

    await expect(
      outside.controller.handleRequest(
        createMockRequest({ path: "/api/mastra//agents" }),
        outside.res,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("enforces Mastra auth, rate limiting, and body size limits including multipart uploads", async () => {
    const route = {
      method: "POST",
      path: "/agents/writer/generate",
      requiresAuth: true,
      authTransport: "bearer",
      maxBodySize: 16,
    };

    const harness = createControllerHarness({
      authEnabled: true,
      authUser: { id: "user-1" },
      coreOptions: {
        prefix: "/api/mastra",
        rateLimitOptions: { enabled: true },
      },
    });
    harness.routeHandler.matchRoute.mockReturnValue({
      route,
      pathParams: {},
    });
    harness.routeHandler.executeHandler.mockResolvedValue({ text: "hello" });

    // Within maxBodySize via mastraRawBodySize
    await harness.controller.handleRequest(
      createMockRequest({
        method: "POST",
        path: "/api/mastra/agents/writer/generate",
        body: { q: "hi" },
        mastraRawBodySize: 10,
      }),
      harness.res,
    );
    expect(harness.authService.authenticate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bearerOnly: true,
        requiresAuth: true,
      }),
    );
    expect(harness.requestContext.setUser).toHaveBeenCalledWith({
      id: "user-1",
    });
    expect(harness.throttleGuard.getRateLimitSettings).toHaveBeenCalled();
    expect(harness.throttleGuard.checkLimit).toHaveBeenCalled();

    // Exceeds maxBodySize via content-length
    await expect(
      harness.controller.handleRequest(
        createMockRequest({
          method: "POST",
          path: "/api/mastra/agents/writer/generate",
          headers: { "content-length": "100" },
          body: { q: "hi" },
        }),
        harness.res,
      ),
    ).rejects.toThrow(PayloadTooLargeException);

    // Exceeds maxBodySize via JSON fallback calculation
    await expect(
      harness.controller.handleRequest(
        createMockRequest({
          method: "POST",
          path: "/api/mastra/agents/writer/generate",
          body: { message: "this payload is definitely longer than 16 bytes" },
        }),
        harness.res,
      ),
    ).rejects.toThrow(PayloadTooLargeException);

    // Undefined body on POST defaults to {} and fits under maxBodySize
    harness.routeHandler.executeHandler.mockClear();
    await harness.controller.handleRequest(
      createMockRequest({
        method: "POST",
        path: "/api/mastra/agents/writer/generate",
        body: undefined,
      }),
      harness.res,
    );
    expect(harness.routeHandler.executeHandler).toHaveBeenCalledWith(
      route,
      expect.objectContaining({ body: {} }),
    );

    // Rate limit disabled skips throttleGuard
    const noRateLimit = createControllerHarness({
      coreOptions: {
        prefix: "/api/mastra",
        rateLimitOptions: { enabled: false },
      },
    });
    noRateLimit.routeHandler.matchRoute.mockReturnValue({
      route: { ...route, maxBodySize: undefined },
      pathParams: {},
    });
    noRateLimit.routeHandler.executeHandler.mockResolvedValue({ ok: true });
    await noRateLimit.controller.handleRequest(
      createMockRequest({
        method: "POST",
        path: "/api/mastra/agents/writer/generate",
        body: { ok: true },
      }),
      noRateLimit.res,
    );
    expect(noRateLimit.throttleGuard.checkLimit).not.toHaveBeenCalled();

    // Multipart form data delegates to parseMultipartFormData
    const boundary = "----NestBootBoundary";
    const multipartPayload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="title"',
      "",
      "hello",
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const stream = Readable.from([Buffer.from(multipartPayload)]);
    const multipartReq = Object.assign(stream, {
      method: "POST",
      path: "/api/mastra/agents/writer/generate",
      url: "/api/mastra/agents/writer/generate",
      originalUrl: "/api/mastra/agents/writer/generate",
      protocol: "http",
      headers: {
        host: "localhost",
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      query: {},
      get: (name: string) =>
        name.toLowerCase() === "host" ? "localhost" : undefined,
    }) as unknown as Request;

    noRateLimit.routeHandler.executeHandler.mockClear();
    await noRateLimit.controller.handleRequest(multipartReq, noRateLimit.res);
    expect(noRateLimit.routeHandler.executeHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.objectContaining({ title: "hello" }) as Record<
          string,
          unknown
        >,
      }),
    );
  });

  it("dispatches unmatched paths to customRoutes with auth, permission, and FGA hooks", async () => {
    const harness = createControllerHarness({
      authEnabled: true,
      authUser: { id: "custom-user" },
    });
    harness.routeHandler.matchRoute.mockReturnValue(null);
    harness.customRoutes.handle.mockImplementation(
      async (
        _req: unknown,
        _res: unknown,
        _ctx: unknown,
        authorize: (
          customRoute: {
            method: string;
            path: string;
            requiresPermission?: string;
            fga?: { relation: string };
          },
          requiresAuth: boolean,
          pathParams: Record<string, string>,
        ) => Promise<void>,
      ) => {
        await authorize(
          {
            method: "POST",
            path: "/custom/:id",
            requiresPermission: "custom:write",
            fga: { relation: "editor" },
          },
          true,
          { id: "42" },
        );
        return true;
      },
    );

    const result = await harness.controller.handleRequest(
      createMockRequest({
        method: "POST",
        path: "/api/mastra/custom/42",
        body: { draft: true },
        query: { mode: "preview" },
      }),
      harness.res,
    );

    expect(result).toBeUndefined();
    expect(harness.authService.authenticate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        requiresAuth: true,
        customRoute: true,
      }),
    );
    expect(harness.requestContext.setUser).toHaveBeenCalledWith({
      id: "custom-user",
    });
    expect(harness.routeHandler.enforceRoutePermission).toHaveBeenCalledTimes(
      1,
    );
    expect(harness.routeHandler.enforceRouteFGA).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/custom/:id" }),
      harness.requestContext.requestContext,
      {
        draft: true,
        mode: "preview",
        id: "42",
      },
    );
  });
});
