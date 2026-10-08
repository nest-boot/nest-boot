import { ServiceUnavailableException } from "@nestjs/common";
import {
  HealthCheckService as TerminusHealthCheckService,
  type HealthIndicatorFunction,
  TerminusModule,
} from "@nestjs/terminus";
import { Test, type TestingModule } from "@nestjs/testing";

import { HealthCheckRegistry, HealthCheckService } from "./index.js";

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
});
