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

    await processor.processRun({
      name: "run",
      data: { name: "Tasks.run" },
    } as never);

    expect(get).toHaveBeenCalledWith("Tasks.run");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects jobs with no registered handler", async () => {
    const { get, registry } = createRegistry();
    const processor = await createProcessor(registry);

    await expect(
      processor.processRun({
        name: "run",
        data: { name: "Missing.run" },
      } as never),
    ).rejects.toThrow('No schedule handler for job "Missing.run"');

    expect(get).toHaveBeenCalledWith("Missing.run");
  });

  it.each([undefined, 4])(
    "uses configured or default worker concurrency (%s)",
    async (concurrency) => {
      const processor = await createProcessor(
        createRegistry().registry,
        concurrency === undefined ? undefined : { concurrency },
      );
      expect(processor.workerOptions.concurrency).toBe(concurrency ?? 1);
    },
  );
});

/**
 * Returns processor configured for the test.
 * @param registry - Registry that owns the configured entries.
 * @param options - Configuration for this operation.
 * @returns Processor configured for the test.
 */
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
