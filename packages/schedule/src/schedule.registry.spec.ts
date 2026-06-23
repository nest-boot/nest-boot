import "reflect-metadata";

vi.mock("@nest-boot/bullmq", () => ({
  InjectQueue: vi.fn(() => vi.fn()),
}));

import { Logger } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Queue } from "bullmq";

import { Cron, Interval } from "./schedule.decorator.js";
import { SCHEDULE_METADATA_KEY } from "./schedule.module-definition.js";
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
          provide: Queue,
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

  it("should discover decorated methods, clean stale schedulers, and register schedules", async () => {
    const { controller, queue, registry } = await createRegistry(
      undefined,
      undefined,
      [
        {
          name: "Old.cron",
          pattern: "0 0 * * *",
        },
        {
          name: "Old.interval",
          every: 5000,
        },
        {
          name: "ControllerSchedules.syncUsers",
          pattern: "*/5 * * * *",
        },
      ],
    );

    await registry.onApplicationBootstrap();
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
        name: "ControllerSchedules.syncUsers",
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
        name: "ProviderSchedules.refreshCache",
        opts: {
          removeOnComplete: true,
        },
      },
    );
  });

  it("should ignore non-object wrappers and methods without schedule metadata", async () => {
    const { discoveryService, metadataScanner, queue, reflector, registry } =
      await createRegistry();

    await registry.onApplicationBootstrap();

    expect(discoveryService.getControllers).toHaveBeenCalledTimes(1);
    expect(discoveryService.getProviders).toHaveBeenCalledTimes(1);
    expect(metadataScanner.getAllMethodNames).toHaveBeenCalledTimes(2);
    expect(reflector.get).toHaveBeenCalledWith(
      SCHEDULE_METADATA_KEY,
      Object.getOwnPropertyDescriptor(
        ControllerSchedules.prototype,
        "undecorated",
      )?.value,
    );
    expect(queue.removeJobScheduler).not.toHaveBeenCalled();
    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    expect(registry.get("ControllerSchedules.undecorated")).toBeUndefined();
  });

  it("should load decorator metadata fallback branches", async () => {
    vi.resetModules();
    vi.doMock("@nest-boot/bullmq", () => ({
      InjectQueue: vi.fn(() => vi.fn()),
    }));
    vi.doMock("bullmq", () => ({
      Queue: undefined,
    }));
    vi.doMock("@nestjs/core", () => ({
      DiscoveryService: undefined,
      MetadataScanner: undefined,
      Reflector: undefined,
    }));

    expect(
      (await import("./schedule.registry.js")).ScheduleRegistry,
    ).toBeDefined();
    vi.doUnmock("@nest-boot/bullmq");
    vi.doUnmock("bullmq");
    vi.doUnmock("@nestjs/core");
  });
});
