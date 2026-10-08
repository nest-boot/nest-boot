import { MiddlewareManager } from "@nest-boot/middleware";
import { RequestMethod, ServiceUnavailableException } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import {
  HealthCheckService as TerminusHealthCheckService,
  type HealthIndicatorFunction,
  TerminusModule,
} from "@nestjs/terminus";
import { Test, type TestingModule } from "@nestjs/testing";

import {
  HealthCheckMiddleware,
  HealthCheckModule,
  HealthCheckRegistry,
  HealthCheckService,
} from "./index.js";

describe("registered health checks", () => {
  let module: TestingModule;
  let registry: HealthCheckRegistry;
  let service: HealthCheckService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [TerminusModule],
      providers: [
        HealthCheckRegistry,
        {
          provide: HealthCheckService,
          inject: [TerminusHealthCheckService, HealthCheckRegistry],
          // Vitest does not emit constructor type metadata. The HTTP suite
          // checks the compiled module's actual dependency injection separately.
          useFactory: (
            terminus: TerminusHealthCheckService,
            registry: HealthCheckRegistry,
          ) => new HealthCheckService(terminus, registry),
        },
      ],
    })
      .setLogger({ log: vi.fn(), warn: vi.fn(), error: vi.fn() })
      .compile();
    registry = module.get(HealthCheckRegistry);
    service = module.get(HealthCheckService);
  });

  afterEach(async () => {
    await module.close();
  });

  it("returns Terminus's healthy empty result when nothing is registered", async () => {
    expect(await service.check()).toEqual({
      status: "ok",
      info: {},
      error: {},
      details: {},
    });
  });

  it("aggregates synchronous and asynchronous indicators from multiple registrations", async () => {
    const first: HealthIndicatorFunction = () => ({
      database: { status: "up", connection: "primary" },
    });
    const second: HealthIndicatorFunction = async () => {
      await Promise.resolve();
      return { cache: { status: "up" } };
    };
    const third: HealthIndicatorFunction = () => ({
      storage: { status: "up" },
    });
    registry.register(first);
    registry.register(second, third);

    expect(registry.healthIndicators).toEqual([first, second, third]);
    const details = {
      database: { status: "up", connection: "primary" },
      cache: { status: "up" },
      storage: { status: "up" },
    };
    expect(await service.check()).toEqual({
      status: "ok",
      info: details,
      error: {},
      details,
    });
  });

  it("preserves failed and successful details in Terminus's unavailable response", async () => {
    registry.register(
      () => ({ database: { status: "down", message: "unavailable" } }),
      () => ({ cache: { status: "up" } }),
    );

    const error = await service.check().catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toEqual({
      status: "error",
      info: { cache: { status: "up" } },
      error: { database: { status: "down", message: "unavailable" } },
      details: {
        cache: { status: "up" },
        database: { status: "down", message: "unavailable" },
      },
    });
  });

  it("runs checks again and includes indicators registered after a previous check", async () => {
    let healthy = true;
    const check = vi.fn<() => { cache: { status: "up" | "down" } }>(() => ({
      cache: { status: healthy ? "up" : "down" },
    }));
    registry.register(check);
    expect((await service.check()).status).toBe("ok");

    healthy = false;
    registry.register(() => ({ database: { status: "up" } }));
    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    healthy = true;
    expect((await service.check()).details).toEqual({
      cache: { status: "up" },
      database: { status: "up" },
    });
    expect(check).toHaveBeenCalledTimes(3);
  });

  it("propagates unexpected indicator failures", async () => {
    const failure = new Error("unexpected failure");
    registry.register(() => {
      throw failure;
    });

    await expect(service.check()).rejects.toBe(failure);
  });

  function createMiddleware() {
    const adapter = { setHeader: vi.fn(), reply: vi.fn() };
    const host = new HttpAdapterHost();
    host.httpAdapter = adapter as unknown as HttpAdapterHost["httpAdapter"];
    return { adapter, middleware: new HealthCheckMiddleware(service, host) };
  }

  it("disables caching before awaiting checks and replies only after they finish", async () => {
    let complete!: () => void;
    const ready = new Promise<void>((resolve) => {
      complete = resolve;
    });
    registry.register(async () => {
      await ready;
      return { cache: { status: "up" } };
    });
    const { adapter, middleware } = createMiddleware();
    const response = {};
    const pending = middleware.use({}, response);
    expect(adapter.setHeader).toHaveBeenCalledWith(
      response,
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );
    expect(adapter.reply).not.toHaveBeenCalled();
    complete();
    await pending;
    expect(adapter.reply).toHaveBeenCalledExactlyOnceWith(
      response,
      {
        status: "ok",
        info: { cache: { status: "up" } },
        error: {},
        details: { cache: { status: "up" } },
      },
      200,
    );
  });

  it.each(["unhealthy", "unexpected"])(
    "propagates %s checks without sending a successful response",
    async (kind) => {
      const failure = new Error("unexpected failure");
      registry.register(() => {
        if (kind === "unexpected") throw failure;
        return { cache: { status: "down" } };
      });
      const { adapter, middleware } = createMiddleware();
      await expect(middleware.use({}, {})).rejects.toBeInstanceOf(
        kind === "unexpected" ? Error : ServiceUnavailableException,
      );
      expect(adapter.setHeader).toHaveBeenCalledOnce();
      expect(adapter.reply).not.toHaveBeenCalled();
    },
  );

  it("registers the health handler for GET through the shared middleware manager", async () => {
    const manager = new MiddlewareManager();
    const { adapter, middleware } = createMiddleware();
    new HealthCheckModule(manager, middleware);
    const configuration = manager.middlewareConfigMap.get(middleware);
    expect(configuration?.routes).toEqual([
      { path: "api/health", method: RequestMethod.GET },
    ]);
    const next = vi.fn();
    await configuration?.middleware({}, {}, next);
    expect(adapter.reply).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });
});
