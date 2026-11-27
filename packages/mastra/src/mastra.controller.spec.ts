import { Readable } from "node:stream";

import type { Mastra } from "@mastra/core/mastra";
import type {
  MastraModuleOptions as MastraCoreModuleOptions,
  MastraThrottleGuard,
  RequestContextService,
  RouteHandlerService,
} from "@mastra/nestjs";
import { NotFoundException, PayloadTooLargeException } from "@nestjs/common";
import { ApplicationConfig } from "@nestjs/core";
import type { Request, Response } from "express";

import { MastraController } from "./mastra.controller.js";
import type { MastraManager } from "./mastra.manager.js";
import type { MastraModuleOptions } from "./mastra.module-definition.js";
import {
  ASSERT_CAN_EXPOSE_TOOL,
  CAN_EXPOSE_TOOL,
  runWithPreflightApprovedTool,
} from "./tool-guard.js";

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
  };
  const requestContext = {
    requestContext: new Map<string, unknown>(),
    abortSignal: new AbortController().signal,
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
    options.moduleOptions ?? { server: true },
    {
      mastra: {} as Mastra,
      prefix: "/api/mastra",
      ...options.coreOptions,
    },
    routeHandler as unknown as RouteHandlerService,
    requestContext as unknown as RequestContextService,
    throttleGuard as unknown as MastraThrottleGuard,
    applicationConfig,
  );

  return {
    controller,
    routeHandler,
    requestContext,
    throttleGuard,
    res: {} as Response,
  };
}

describe("MastraController", () => {
  it("throws NotFoundException when server is headless by default or explicitly disabled", async () => {
    for (const moduleOptions of [{}, { server: false }] as const) {
      const { controller, res } = createControllerHarness({ moduleOptions });
      await expect(
        controller.handleRequest(createMockRequest(), res),
      ).rejects.toThrow(NotFoundException);
    }
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

  it("enforces rate limiting and body size limits including multipart uploads", async () => {
    const route = {
      method: "POST",
      path: "/agents/writer/generate",
      requiresAuth: true,
      authTransport: "bearer",
      maxBodySize: 16,
    };

    const harness = createControllerHarness({
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

  it("returns 404 for unmatched routes without invoking a handler", async () => {
    const harness = createControllerHarness();
    harness.routeHandler.matchRoute.mockReturnValue(null);
    await expect(
      harness.controller.handleRequest(
        createMockRequest({ path: "/api/mastra/custom/42" }),
        harness.res,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(harness.routeHandler.executeHandler).not.toHaveBeenCalled();
  });

  it("filters unauthorized tools on GET /tools and returns 404 on GET /tools/:toolId", async () => {
    const allowedTool = {
      id: "allowed-tool",
      [CAN_EXPOSE_TOOL]: () => Promise.resolve(true),
    };
    const deniedTool = {
      id: "denied-tool",
      [CAN_EXPOSE_TOOL]: () => Promise.resolve(false),
    };
    const mastraManager = {
      getTool: vi.fn((id: string) => {
        if (id === "allowed-tool") {
          return allowedTool;
        }
        if (id === "denied-tool") {
          return deniedTool;
        }
        return undefined;
      }),
    } as unknown as MastraManager;

    const routeHandler = {
      matchRoute: vi.fn(),
      executeHandler: vi.fn(),
    };
    const requestContext = {
      requestContext: new Map<string, unknown>(),
      abortSignal: new AbortController().signal,
    };
    const throttleGuard = {
      getRateLimitSettings: vi
        .fn()
        .mockReturnValue({ limit: 60, windowMs: 1000 }),
      checkLimit: vi.fn().mockResolvedValue(undefined),
    };

    const controller = new MastraController(
      { server: true },
      { mastra: {} as Mastra, prefix: "/api/mastra" },
      routeHandler as unknown as RouteHandlerService,
      requestContext as unknown as RequestContextService,
      throttleGuard as unknown as MastraThrottleGuard,
      undefined,
      mastraManager,
    );

    routeHandler.matchRoute.mockReturnValue({
      route: { method: "GET", path: "/tools" },
      pathParams: {},
    });
    routeHandler.executeHandler.mockResolvedValue({
      responseType: "json",
      data: {
        allowedKey: { id: "allowed-tool" },
        deniedByKey: { description: "no id field" },
        deniedKey: { id: "denied-tool" },
      },
    });

    const listResult = await controller.handleRequest(
      createMockRequest({ path: "/api/mastra/tools" }),
      {} as Response,
    );
    expect(listResult).toEqual({
      responseType: "json",
      data: {
        allowedKey: { id: "allowed-tool" },
        deniedByKey: { description: "no id field" },
      },
    });

    routeHandler.matchRoute.mockReturnValue({
      route: { method: "GET", path: "/tools/:toolId" },
      pathParams: { toolId: "allowed-tool" },
    });
    routeHandler.executeHandler.mockResolvedValue({
      responseType: "json",
      data: { id: "allowed-tool" },
    });
    await controller.handleRequest(
      createMockRequest({
        path: "/api/mastra/tools/allowed-tool",
        query: { toolId: "denied-tool", extra: "kept" },
      }),
      {} as Response,
    );
    expect(routeHandler.executeHandler).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        pathParams: { toolId: "allowed-tool" },
        queryParams: { extra: "kept" },
      }),
    );

    routeHandler.matchRoute.mockReturnValue({
      route: { method: "GET", path: "/tools/:toolId" },
      pathParams: { toolId: "denied-tool" },
    });
    await expect(
      controller.handleRequest(
        createMockRequest({ path: "/api/mastra/tools/denied-tool" }),
        {} as Response,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("honors options.tools and getToolByRegistrationKey on GET /tools, projects public tool metadata across tool/agent routes, and passes preflight approval on POST /tools/:toolId/execute", async () => {
    let discoveryChecks = 0;
    const preflightedOptionTool = {
      id: "option-allowed-tool",
      [CAN_EXPOSE_TOOL]: () => Promise.resolve(true),
      [ASSERT_CAN_EXPOSE_TOOL]: () => {
        discoveryChecks += 1;
        return Promise.resolve();
      },
    };
    const deniedOptionTool = {
      id: "option-denied-tool",
      [CAN_EXPOSE_TOOL]: () => Promise.resolve(false),
    };
    const registryAllowedTool = {
      id: "registry-allowed-id",
      [CAN_EXPOSE_TOOL]: () => Promise.resolve(true),
    };
    const registryDeniedTool = {
      id: "colliding-denied-id",
      [CAN_EXPOSE_TOOL]: () => Promise.resolve(false),
    };

    const mastraManager = {
      // Simulate getTool prioritizing intrinsic id ("colliding-denied-id" -> registryDeniedTool)
      getTool: vi.fn((id: string) => {
        if (id === "colliding-denied-id") {
          return registryDeniedTool;
        }
        if (id === "registry-allowed-id") {
          return registryAllowedTool;
        }
        return undefined;
      }),
      // Exact registry key lookup resolves registryAllowedTool registered under key "colliding-denied-id"
      getToolByRegistrationKey: vi.fn((key: string) => {
        if (key === "colliding-denied-id") {
          return registryAllowedTool;
        }
        if (key === "option-allowed-tool") {
          return preflightedOptionTool;
        }
        if (
          key === "denied-reg-key" ||
          key === "sharedKeyOverwrittenByDeniedRegistryTool"
        ) {
          return registryDeniedTool;
        }
        return undefined;
      }),
    } as unknown as MastraManager;

    const routeHandler = {
      matchRoute: vi.fn(),
      executeHandler: vi.fn(),
    };
    const requestContext = {
      requestContext: new Map<string, unknown>(),
      abortSignal: new AbortController().signal,
    };
    const throttleGuard = {
      getRateLimitSettings: vi
        .fn()
        .mockReturnValue({ limit: 60, windowMs: 1000 }),
      checkLimit: vi.fn().mockResolvedValue(undefined),
    };

    const controller = new MastraController(
      { server: true },
      {
        mastra: {} as Mastra,
        prefix: "/api/mastra",
        tools: {
          optionAllowed: preflightedOptionTool as never,
          optionDenied: deniedOptionTool as never,
          sharedKeyOverwrittenByDeniedRegistryTool: {
            id: "adapter-overwritten-allowed-id",
            [CAN_EXPOSE_TOOL]: () => Promise.resolve(true),
          } as never,
        },
      },
      routeHandler as unknown as RouteHandlerService,
      requestContext as unknown as RequestContextService,
      throttleGuard as unknown as MastraThrottleGuard,
      undefined,
      mastraManager,
    );

    // 1. GET /tools filters options.tools AND resolves Mastra tools by exact registration key while projecting metadata
    routeHandler.matchRoute.mockReturnValue({
      route: { method: "GET", path: "/tools" },
      pathParams: {},
    });
    routeHandler.executeHandler.mockResolvedValue({
      responseType: "json",
      data: {
        optionAllowed: {
          id: "option-allowed-tool",
          description: "Allowed option tool",
          requireApproval: true,
          leakedService: { secret: "hidden" },
        },
        "option-allowed-tool": "primitive-tool-entry",
        optionDenied: {
          id: "option-denied-tool",
          description: "Denied option tool",
        },
        "colliding-denied-id": {
          id: "registry-allowed-id",
          description: "Allowed despite key matching another tool's id",
          privateField: "stripped",
        },
        "denied-reg-key": {
          id: "colliding-denied-id",
          description: "Denied registry tool",
        },
        sharedKeyOverwrittenByDeniedRegistryTool: {
          id: "colliding-denied-id",
          description: "Registry overwrote adapter key with a denied tool",
        },
      },
    });

    const toolsListRes = await controller.handleRequest(
      createMockRequest({ path: "/api/mastra/tools" }),
      {} as Response,
    );
    expect(toolsListRes).toEqual({
      responseType: "json",
      data: {
        optionAllowed: {
          id: "option-allowed-tool",
          description: "Allowed option tool",
          requireApproval: true,
        },
        "option-allowed-tool": "primitive-tool-entry",
        "colliding-denied-id": {
          id: "registry-allowed-id",
          description: "Allowed despite key matching another tool's id",
        },
      },
    });

    // 2. GET /agents and GET /agents/:agentId strip leaked tool fields while preserving agent metadata
    routeHandler.matchRoute.mockReturnValue({
      route: { method: "GET", path: "/agents" },
      pathParams: {},
    });
    routeHandler.executeHandler.mockResolvedValue({
      responseType: "json",
      data: {
        writer: {
          name: "Writer",
          tools: {
            echo: {
              id: "echo-tool",
              title: "Echo",
              inputSchema: "{}",
              injectedRepo: { token: "secret" },
            },
          },
        },
        bareAgentWithoutTools: {
          name: "Bare Agent",
        },
      },
    });
    expect(
      await controller.handleRequest(
        createMockRequest({ path: "/api/mastra/agents" }),
        {} as Response,
      ),
    ).toEqual({
      responseType: "json",
      data: {
        writer: {
          name: "Writer",
          tools: {
            echo: {
              id: "echo-tool",
              title: "Echo",
              inputSchema: "{}",
            },
          },
        },
        bareAgentWithoutTools: {
          name: "Bare Agent",
        },
      },
    });

    // 3. POST /tools/:toolId/execute runs preflight exposure check once and forwards preflight token into handler scope
    let sawNestedPreflightScope = false;
    routeHandler.matchRoute.mockReturnValue({
      route: { method: "POST", path: "/tools/:toolId/execute" },
      pathParams: { toolId: "option-allowed-tool" },
    });
    routeHandler.executeHandler.mockImplementation(async () => {
      await runWithPreflightApprovedTool(
        { targetToolId: "option-allowed-tool" },
        () => {
          sawNestedPreflightScope = true;
          return Promise.resolve();
        },
      );
      return { responseType: "json", data: { ok: true } };
    });

    const execRes = await controller.handleRequest(
      createMockRequest({
        method: "POST",
        path: "/api/mastra/tools/option-allowed-tool/execute",
        body: { data: {} },
      }),
      {} as Response,
    );
    expect(execRes).toEqual({ responseType: "json", data: { ok: true } });
    expect(discoveryChecks).toBe(1);
    expect(sawNestedPreflightScope).toBe(true);
  });
});
