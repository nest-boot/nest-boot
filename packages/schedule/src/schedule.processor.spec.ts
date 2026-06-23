const { mockProcessor, mockProcessorDecorator } = vi.hoisted(() => {
  const mockProcessorDecorator = vi.fn();
  const mockProcessor = vi.fn(() => mockProcessorDecorator);

  return {
    mockProcessor,
    mockProcessorDecorator,
  };
});

vi.mock("@nest-boot/bullmq", () => ({
  InjectQueue: vi.fn(() => vi.fn()),
  Processor: mockProcessor,
  WorkerHost: class WorkerHost {
    worker = {
      concurrency: 1,
      run: vi.fn().mockResolvedValue(undefined),
    };
  },
}));

import { type Provider } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { MODULE_OPTIONS_TOKEN } from "./schedule.module-definition.js";
import { ScheduleProcessor } from "./schedule.processor.js";
import { ScheduleRegistry } from "./schedule.registry.js";
import { type ScheduleModuleOptions } from "./schedule-module-options.interface.js";

describe("ScheduleProcessor", () => {
  const createRegistry = (entry?: ReturnType<ScheduleRegistry["get"]>) => {
    const get = vi.fn(() => entry);

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
    const handler = vi.fn().mockResolvedValue(undefined);
    const { get, registry } = createRegistry({
      handler,
      options: {
        type: "cron",
        value: "* * * * *",
      },
    });
    const processor = await createProcessor(registry);

    await processor.process({
      name: "Tasks.run",
    } as never);

    expect(get).toHaveBeenCalledWith("Tasks.run");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should ignore jobs with no registered handler", async () => {
    const { get, registry } = createRegistry();
    const processor = await createProcessor(registry);

    await expect(
      processor.process({
        name: "Missing.run",
      } as never),
    ).resolves.toBeUndefined();

    expect(get).toHaveBeenCalledWith("Missing.run");
  });

  it("should configure concurrency and start the worker by default", async () => {
    const processor = await createProcessor(createRegistry().registry, {
      concurrency: 4,
    });

    processor.onApplicationBootstrap();

    expect((processor as any).worker.concurrency).toBe(4);
    expect((processor as any).worker.run).toHaveBeenCalledTimes(1);
  });

  it("should skip autorun when disabled", async () => {
    const processor = await createProcessor(createRegistry().registry, {
      autorun: false,
    });

    processor.onApplicationBootstrap();

    expect((processor as any).worker.concurrency).toBe(1);
    expect((processor as any).worker.run).not.toHaveBeenCalled();
  });

  it("should swallow worker run errors", async () => {
    const processor = await createProcessor(createRegistry().registry);
    (processor as any).worker.run.mockRejectedValueOnce(new Error("boom"));

    expect(() => {
      processor.onApplicationBootstrap();
    }).not.toThrow();
    await Promise.resolve();

    expect((processor as any).worker.run).toHaveBeenCalledTimes(1);
  });

  it("should load decorator metadata fallback branches", async () => {
    vi.resetModules();
    vi.doMock("@nest-boot/bullmq", () => ({
      InjectQueue: vi.fn(() => vi.fn()),
      Processor: vi.fn(() => vi.fn()),
      WorkerHost: class WorkerHost {
        worker = {
          concurrency: 1,
          run: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));
    vi.doMock("./schedule.registry.js", () => ({
      ScheduleRegistry: undefined,
    }));

    expect(
      (await import("./schedule.processor.js")).ScheduleProcessor,
    ).toBeDefined();

    vi.doUnmock("./schedule.registry.js");
    vi.resetModules();
    vi.doMock("@nest-boot/bullmq", () => ({
      InjectQueue: vi.fn(() => vi.fn()),
      Processor: vi.fn(() => vi.fn()),
      WorkerHost: class WorkerHost {
        worker = {
          concurrency: 1,
          run: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));
    vi.doMock("./schedule-module-options.interface.js", () => ({
      ScheduleModuleOptions: class ScheduleModuleOptions {},
    }));

    expect(
      (await import("./schedule.processor.js")).ScheduleProcessor,
    ).toBeDefined();
    vi.doUnmock("./schedule-module-options.interface.js");
    vi.doUnmock("@nest-boot/bullmq");
  });
});

async function createProcessor(
  registry: ScheduleRegistry,
  options?: ScheduleModuleOptions,
) {
  const providers: Provider[] = [
    ScheduleProcessor,
    {
      provide: ScheduleRegistry,
      useValue: registry,
    },
  ];

  if (typeof options !== "undefined") {
    providers.push({
      provide: MODULE_OPTIONS_TOKEN,
      useValue: options,
    });
  }

  const moduleRef = await Test.createTestingModule({
    providers,
  }).compile();

  return moduleRef.get(ScheduleProcessor);
}
