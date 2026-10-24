import "reflect-metadata";

import { ScheduleQueue } from "./schedule.queue.js";

vi.mock("@nest-boot/queue", () => ({
  Queue: vi.fn(() => vi.fn()),
  BaseQueue: class BaseQueue {},
}));

import { Logger } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";

import { Cron, Interval } from "./schedule.decorator.js";
import { ScheduleRegistry } from "./schedule.registry.js";

describe("ScheduleRegistry", () => {
  class ControllerSchedules {
    calls: string[] = [];

    @Cron("*/5 * * * *", {
      attempts: 2,
      timezone: "Asia/Shanghai",
    })
    async syncUsers() {
      await Promise.resolve();
      this.calls.push("syncUsers");
    }

    undecorated() {
      return undefined;
    }
  }

  class ProviderSchedules {
    calls: string[] = [];

    @Interval("1000", {
      removeOnComplete: true,
    })
    async refreshCache() {
      await Promise.resolve();
      this.calls.push("refreshCache");
    }
  }

  const createRegistry = async (
    controller = new ControllerSchedules(),
    provider = new ProviderSchedules(),
    schedulers: {
      key: string;
      name: string;
      pattern?: string;
      every?: number;
    }[] = [],
  ) => {
    const queue = {
      getJobSchedulers: vi.fn().mockResolvedValue(schedulers),
      removeJobScheduler: vi.fn().mockResolvedValue(undefined),
      upsertJobScheduler: vi.fn().mockResolvedValue(undefined),
    };
    const reflector = {
      get: vi.fn((key: string, handler: (...args: never[]) => unknown) =>
        Reflect.getMetadata(key, handler),
      ),
    };
    const discoveryService = {
      getControllers: vi.fn(() => [
        {
          instance: controller,
        },
        {
          instance: null,
        },
      ]),
      getProviders: vi.fn(() => [
        {
          instance: provider,
        },
        {
          instance: undefined,
        },
      ]),
    };
    const metadataScanner = {
      getAllMethodNames: vi.fn((prototype: object) =>
        Object.getOwnPropertyNames(prototype).filter(
          (key) => key !== "constructor",
        ),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ScheduleRegistry,
        {
          provide: ScheduleQueue,
          useValue: queue,
        },
        {
          provide: Reflector,
          useValue: reflector,
        },
        {
          provide: DiscoveryService,
          useValue: discoveryService,
        },
        {
          provide: MetadataScanner,
          useValue: metadataScanner,
        },
      ],
    }).compile();
    const registry = moduleRef.get(ScheduleRegistry);

    vi.spyOn((registry as any).logger, "log").mockImplementation(vi.fn());

    return {
      controller,
      moduleRef,
      discoveryService,
      metadataScanner,
      provider,
      queue,
      reflector,
      registry,
    };
  };

  beforeEach(() => {
    vi.spyOn(Logger.prototype, "log").mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers schedules when the Nest application initializes", async () => {
    const { queue, moduleRef } = await createRegistry();
    await moduleRef.init();
    expect(queue.getJobSchedulers).toHaveBeenCalledOnce();
    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    await moduleRef.close();
  });

  it("propagates Redis schedule registration errors", async () => {
    const { queue, registry } = await createRegistry();
    const failure = new Error("Redis unavailable");
    queue.getJobSchedulers.mockRejectedValue(failure);
    await expect(registry.onApplicationBootstrap()).rejects.toBe(failure);
  });
  it("should discover decorated methods, clean stale schedulers, and register schedules", async () => {
    const { controller, queue, registry } = await createRegistry(
      undefined,
      undefined,
      [
        {
          key: "Old.cron",
          name: "run",
          pattern: "0 0 * * *",
        },
        {
          key: "Old.interval",
          name: "run",
          every: 5000,
        },
        {
          key: "ControllerSchedules.syncUsers",
          name: "run",
          pattern: "*/5 * * * *",
        },
      ],
    );

    await registry.register();
    await registry.get("ControllerSchedules.syncUsers")?.handler();

    expect(controller.calls).toEqual(["syncUsers"]);
    expect(queue.removeJobScheduler).toHaveBeenCalledTimes(2);
    expect(queue.removeJobScheduler).toHaveBeenCalledWith("Old.cron");
    expect(queue.removeJobScheduler).toHaveBeenCalledWith("Old.interval");
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      "ControllerSchedules.syncUsers",
      {
        pattern: "*/5 * * * *",
        tz: "Asia/Shanghai",
      },
      {
        name: "run",
        data: { name: "ControllerSchedules.syncUsers" },
        opts: {
          attempts: 2,
        },
      },
    );
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      "ProviderSchedules.refreshCache",
      {
        every: 1000,
        tz: "UTC",
      },
      {
        name: "run",
        data: { name: "ProviderSchedules.refreshCache" },
        opts: {
          removeOnComplete: true,
        },
      },
    );
  });
});
