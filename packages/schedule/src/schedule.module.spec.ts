import { Test } from "@nestjs/testing";

const { createQueue } = vi.hoisted(() => ({ createQueue: vi.fn() }));

vi.mock("@nest-boot/queue", () => ({
  Queue: vi.fn(() => vi.fn()),
  BaseQueue: class BaseQueue {
    constructor(...args: unknown[]) {
      createQueue(...args);
    }
  },
  Processor: vi.fn(() => vi.fn()),
  BaseProcessor: class BaseProcessor {},
}));

import { ScheduleModule } from "./schedule.module.js";
import { MODULE_OPTIONS_TOKEN } from "./schedule.module-definition.js";
import { ScheduleQueue } from "./schedule.queue.js";

describe("ScheduleModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["default", "sync", "async"])(
    "injects %s configuration into the schedule queue",
    async (mode) => {
      const options = {
        connection: { schema: "schedule_test" },
        concurrency: 3,
      };
      const module = await Test.createTestingModule({
        imports: [
          mode === "default"
            ? ScheduleModule
            : mode === "sync"
              ? ScheduleModule.forRoot(options)
              : ScheduleModule.forRootAsync({
                  useFactory: async () => await Promise.resolve(options),
                }),
        ],
      }).compile();
      try {
        expect(module.get(ScheduleQueue)).toBeInstanceOf(ScheduleQueue);
        expect(module.get(MODULE_OPTIONS_TOKEN)).toEqual(
          mode === "default" ? {} : options,
        );
        expect(createQueue).toHaveBeenCalledExactlyOnceWith(
          mode === "default" ? {} : { connection: options.connection },
          undefined,
        );
      } finally {
        await module.close();
      }
    },
  );

  it.each(["sync", "async"])(
    "namespaces the schedule queue with %s options",
    async (mode) => {
      const options = { queueName: "billing-schedule", concurrency: 2 };
      const module = await Test.createTestingModule({
        imports: [
          mode === "sync"
            ? ScheduleModule.forRoot(options)
            : ScheduleModule.forRootAsync({ useFactory: () => options }),
        ],
      }).compile();
      try {
        expect(createQueue).toHaveBeenCalledExactlyOnceWith(
          {},
          "billing-schedule",
        );
        expect(options).toEqual({
          queueName: "billing-schedule",
          concurrency: 2,
        });
      } finally {
        await module.close();
      }
    },
  );
});
