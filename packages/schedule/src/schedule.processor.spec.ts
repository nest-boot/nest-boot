const mockProcessorDecorator = jest.fn();
const mockProcessor = jest.fn(() => mockProcessorDecorator);

jest.mock("@nest-boot/bullmq", () => ({
  InjectQueue: jest.fn(() => jest.fn()),
  Processor: mockProcessor,
  WorkerHost: class WorkerHost {
    worker = {
      concurrency: 1,
      run: jest.fn().mockResolvedValue(undefined),
    };
  },
}));

import { ScheduleProcessor } from "./schedule.processor";
import { type ScheduleRegistry } from "./schedule.registry";

describe("ScheduleProcessor", () => {
  const createRegistry = (entry?: ReturnType<ScheduleRegistry["get"]>) => {
    const get = jest.fn(() => entry);

    return {
      get,
      registry: {
        get,
      } as unknown as ScheduleRegistry,
    };
  };

  it("should apply the schedule processor decorator", () => {
    expect(mockProcessor).toHaveBeenCalledWith("schedule", {
      autorun: false,
    });
    expect(mockProcessorDecorator).toHaveBeenCalledWith(ScheduleProcessor);
  });

  it("should invoke the registered schedule handler for the job name", async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const { get, registry } = createRegistry({
      handler,
      options: {
        type: "cron",
        value: "* * * * *",
      },
    });
    const processor = new ScheduleProcessor(registry);

    await processor.process({
      name: "Tasks.run",
    } as never);

    expect(get).toHaveBeenCalledWith("Tasks.run");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should ignore jobs with no registered handler", async () => {
    const { get, registry } = createRegistry();
    const processor = new ScheduleProcessor(registry);

    await expect(
      processor.process({
        name: "Missing.run",
      } as never),
    ).resolves.toBeUndefined();

    expect(get).toHaveBeenCalledWith("Missing.run");
  });

  it("should configure concurrency and start the worker by default", () => {
    const processor = new ScheduleProcessor(createRegistry().registry, {
      concurrency: 4,
    });

    processor.onApplicationBootstrap();

    expect((processor as any).worker.concurrency).toBe(4);
    expect((processor as any).worker.run).toHaveBeenCalledTimes(1);
  });

  it("should skip autorun when disabled", () => {
    const processor = new ScheduleProcessor(createRegistry().registry, {
      autorun: false,
    });

    processor.onApplicationBootstrap();

    expect((processor as any).worker.concurrency).toBe(1);
    expect((processor as any).worker.run).not.toHaveBeenCalled();
  });

  it("should swallow worker run errors", async () => {
    const processor = new ScheduleProcessor(createRegistry().registry);
    (processor as any).worker.run.mockRejectedValueOnce(new Error("boom"));

    expect(() => {
      processor.onApplicationBootstrap();
    }).not.toThrow();
    await Promise.resolve();

    expect((processor as any).worker.run).toHaveBeenCalledTimes(1);
  });

  it("should load decorator metadata fallback branches", async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock("@nest-boot/bullmq", () => ({
        InjectQueue: jest.fn(() => jest.fn()),
        Processor: jest.fn(() => jest.fn()),
        WorkerHost: class WorkerHost {
          worker = {
            concurrency: 1,
            run: jest.fn().mockResolvedValue(undefined),
          };
        },
      }));
      jest.doMock("./schedule.registry", () => ({
        ScheduleRegistry: undefined,
      }));

      const module = await import("./schedule.processor");

      expect(module.ScheduleProcessor).toBeDefined();
    });

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@nest-boot/bullmq", () => ({
        InjectQueue: jest.fn(() => jest.fn()),
        Processor: jest.fn(() => jest.fn()),
        WorkerHost: class WorkerHost {
          worker = {
            concurrency: 1,
            run: jest.fn().mockResolvedValue(undefined),
          };
        },
      }));
      jest.doMock("./schedule-module-options.interface", () => ({
        ScheduleModuleOptions: class ScheduleModuleOptions {},
      }));

      const module = await import("./schedule.processor");

      expect(module.ScheduleProcessor).toBeDefined();
    });
  });
});
