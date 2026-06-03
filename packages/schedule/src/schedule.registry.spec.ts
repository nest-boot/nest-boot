import "reflect-metadata";

jest.mock("@nest-boot/bullmq", () => ({
  InjectQueue: jest.fn(() => jest.fn()),
}));

import { Logger } from "@nestjs/common";

import { Cron, Interval } from "./schedule.decorator";
import { SCHEDULE_METADATA_KEY } from "./schedule.module-definition";
import { ScheduleRegistry } from "./schedule.registry";

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

  const createRegistry = (
    controller = new ControllerSchedules(),
    provider = new ProviderSchedules(),
    schedulers: {
      name: string;
      pattern?: string;
      every?: number;
    }[] = [],
  ) => {
    const queue = {
      getJobSchedulers: jest.fn().mockResolvedValue(schedulers),
      removeJobScheduler: jest.fn().mockResolvedValue(undefined),
      upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    };
    const reflector = {
      get: jest.fn((key: string, handler: (...args: never[]) => unknown) =>
        Reflect.getMetadata(key, handler),
      ),
    };
    const discoveryService = {
      getControllers: jest.fn(() => [
        {
          instance: controller,
        },
        {
          instance: null,
        },
      ]),
      getProviders: jest.fn(() => [
        {
          instance: provider,
        },
        {
          instance: undefined,
        },
      ]),
    };
    const metadataScanner = {
      getAllMethodNames: jest.fn((prototype: object) =>
        Object.getOwnPropertyNames(prototype).filter(
          (key) => key !== "constructor",
        ),
      ),
    };
    const registry = new ScheduleRegistry(
      queue as never,
      reflector as never,
      discoveryService as never,
      metadataScanner as never,
    );

    jest.spyOn((registry as any).logger, "log").mockImplementation(jest.fn());

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
    jest.spyOn(Logger.prototype, "log").mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should discover decorated methods, clean stale schedulers, and register schedules", async () => {
    const { controller, queue, registry } = createRegistry(
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
      createRegistry();

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
    await jest.isolateModulesAsync(async () => {
      jest.doMock("@nest-boot/bullmq", () => ({
        InjectQueue: jest.fn(() => jest.fn()),
      }));
      jest.doMock("bullmq", () => ({
        Queue: undefined,
      }));
      jest.doMock("@nestjs/core", () => ({
        DiscoveryService: undefined,
        MetadataScanner: undefined,
        Reflector: undefined,
      }));

      const module = await import("./schedule.registry");

      expect(module.ScheduleRegistry).toBeDefined();
    });
  });
});
