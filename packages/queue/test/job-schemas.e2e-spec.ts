import { Test, type TestingModule } from "@nestjs/testing";
import { Job as BullmqJob, Queue as BullmqQueue } from "bullmq";
import { z } from "zod";

import {
  BaseProcessor,
  BaseQueue,
  type Job,
  Processor,
  Queue,
  QueueManager,
  QueueModule,
} from "../dist/index.js";
import { createRedisFixture } from "./redis.fixture.js";

describe("Redis job schema contracts", () => {
  let fixture: Awaited<ReturnType<typeof createRedisFixture>>;
  let app: TestingModule;
  let raw: BullmqQueue;
  const handled = vi.fn();
  const updated = vi.fn();

  @Queue("typed")
  class TypedQueue extends BaseQueue {
    readonly jobSchemas = {
      "send-email": {
        data: z.object({ text: z.string().transform((text) => text.length) }),
        result: z.object({ length: z.number() }),
      },
      "result-length": {
        data: z.object({}),
        result: z.string().transform((value) => value.length),
      },
      "update-and-retry": {
        data: z.object({
          text: z.string().transform(async (text) => {
            await Promise.resolve();
            return text.length;
          }),
        }),
        result: z.number(),
      },
      "original-values": {
        data: z.object({
          count: z.coerce.number(),
          label: z.string().default("default"),
        }),
        result: z.object({
          count: z.coerce.number(),
          label: z.string().default("default"),
        }),
      },
      notify: { data: z.object({ userId: z.string() }) },
      badResult: { data: z.object({}), result: z.number() },
      badVoid: { data: z.object({}) },
      "missing-handler": { data: z.object({}) },
    };
    constructor() {
      super(fixture.options);
    }
  }

  @Processor(TypedQueue)
  class TypedProcessor extends BaseProcessor {
    async processSendEmail(job: Job<TypedQueue, "send-email">) {
      handled(job.name, job.data);
      await Promise.resolve();
      return { length: job.data.text.length };
    }
    async processResultLength(_job: Job<TypedQueue, "result-length">) {
      await Promise.resolve();
      return "checked";
    }
    async processUpdateAndRetry(job: Job<TypedQueue, "update-and-retry">) {
      handled(job.name, job.data);
      if (job.attemptsMade === 0) {
        expect(job).toBeInstanceOf(BullmqJob);
        expect(Object.hasOwn(job, "updateData")).toBe(false);
        await job.updateData(job.data);
        updated(job.data);
        throw new Error("Retry after updating the raw input");
      }
      return job.data.text.length;
    }
    async processOriginalValues(job: Job<TypedQueue, "original-values">) {
      expectTypeOf(job.data.label).toEqualTypeOf<string | undefined>();
      expectTypeOf(job.data.count).toBeUnknown();
      handled(job.name, job.data);
      await Promise.resolve();
      return job.data;
    }
    async processNotify(job: Job<TypedQueue, "notify">) {
      handled(job.name, job.data);
      await Promise.resolve();
    }
    async processBadResult(_job: Job<TypedQueue, "badResult">) {
      await Promise.resolve();
      // Simulate JavaScript or a cast bypassing the static result contract.
      return "invalid-result" as never;
    }
    async processBadVoid(_job: Job<TypedQueue, "badVoid">) {
      await Promise.resolve();
      return "undeclared-result" as never;
    }
    async processMissingHandler(_job: Job<TypedQueue, "missing-handler">) {
      await Promise.resolve();
    }
  }

  beforeAll(async () => {
    fixture = await createRedisFixture();
    app = await Test.createTestingModule({
      imports: [QueueModule],
      providers: [TypedQueue, TypedProcessor],
    })

      .compile();
    await app.init();
    raw = new BullmqQueue("typed", fixture.options);
    await app.get(QueueManager).start();
  }, 30000);

  afterAll(async () => {
    await app?.close();
    await raw?.close();
    await fixture?.close();
  });
  beforeEach(() => {
    handled.mockClear();
    updated.mockClear();
  });

  it("validates data at enqueue and consumption without replacing the original values", async () => {
    const queue = app.get(TypedQueue);
    const job = await queue.add("send-email", { text: "hello" });
    expectTypeOf(job.data.text).toEqualTypeOf<string>();
    expectTypeOf(job.returnvalue).toEqualTypeOf<{ length: number }>();
    expect(job.data.text).toBe("hello");
    await vi.waitFor(async () => {
      expect(await job.getState()).toBe("completed");
    });
    const stored = await queue.getJob(String(job.id));
    expect(stored?.data).toEqual({ text: "hello" });
    expect(stored?.returnvalue).toEqual({ length: 5 });
    expect(handled).toHaveBeenCalledWith("send-email", { text: "hello" });
  });

  it("validates results and stores their original values", async () => {
    const queue = app.get(TypedQueue);
    const job = await queue.add("result-length", {});
    expectTypeOf(job.returnvalue).toEqualTypeOf<string>();
    await vi.waitFor(async () => {
      expect(await job.getState()).toBe("completed");
    });
    expect((await queue.getJob(String(job.id)))?.returnvalue).toBe("checked");
  });

  it("can write job.data back unchanged and validate it again on retry", async () => {
    const queue = app.get(TypedQueue);
    const job = await queue.add(
      "update-and-retry",
      { text: "hello" },
      { attempts: 2 },
    );
    await vi.waitFor(async () => {
      expect(await job.getState()).toBe("completed");
    });
    const stored = await queue.getJob(String(job.id));
    expect(stored?.data).toEqual({ text: "hello" });
    expect(stored?.returnvalue).toBe(5);
    expect(stored?.attemptsMade).toBe(2);
    expect(updated).toHaveBeenCalledExactlyOnceWith({ text: "hello" });
    expect(handled.mock.calls).toEqual([
      ["update-and-retry", { text: "hello" }],
      ["update-and-retry", { text: "hello" }],
    ]);
  });

  it("preserves defaults, coercions and unknown fields as originally supplied", async () => {
    const data = { count: "12", extra: "keep" };
    const queue = app.get(TypedQueue);
    const job = await queue.add("original-values", data);
    await vi.waitFor(async () => {
      expect(await job.getState()).toBe("completed");
    });
    const stored = await queue.getJob(String(job.id));
    expect(stored?.data).toEqual(data);
    expect(stored?.returnvalue).toEqual(data);
    expect(handled).toHaveBeenCalledExactlyOnceWith("original-values", data);
  });

  it("validates data changed by native updateData before a retry enters the handler", async () => {
    const processor = app.get(TypedProcessor);
    const process = vi
      .spyOn(processor, "processUpdateAndRetry")
      .mockImplementationOnce(async (job) => {
        await job.updateData({ text: 123 as unknown as string });
        throw new Error("Retry with invalid input");
      });
    try {
      const job = await app
        .get(TypedQueue)
        .add("update-and-retry", { text: "hello" }, { attempts: 2 });
      await vi.waitFor(async () => {
        expect(await job.getState()).toBe("failed");
      });
      const stored = await raw.getJob(String(job.id));
      expect(stored?.attemptsMade).toBe(2);
      expect(stored?.failedReason).toContain("invalid_type");
      expect(stored?.failedReason).toContain('"text"');
      expect(process).toHaveBeenCalledOnce();
    } finally {
      process.mockRestore();
    }
  });
  it("rejects invalid payloads before creating Redis jobs, including whole batches", async () => {
    const queue = app.get(TypedQueue);
    const count = await raw.count();
    await expect(
      queue.add("send-email", { text: 123 } as never),
    ).rejects.toThrow();
    await expect(
      queue.addBulk([
        { name: "notify", data: { userId: "123" } },
        { name: "send-email", data: { text: 123 } as never },
      ]),
    ).rejects.toThrow();
    expect(await raw.count()).toBe(count);
    expect(handled).not.toHaveBeenCalled();
  });

  it.each([
    ["send-email", { text: 123 }],
    ["unknown", {}],
  ])(
    "rejects an externally written invalid %s job before invoking the Processor",
    async (name, data) => {
      const job = await raw.add(name, data);
      await vi.waitFor(async () => {
        expect(await job.getState()).toBe("failed");
      });
      expect(handled).not.toHaveBeenCalled();
    },
  );

  it.each(["badResult", "badVoid"] as const)(
    "fails %s instead of completing an invalid return value",
    async (name) => {
      const job = await app.get(TypedQueue).add(name, {});
      await vi.waitFor(async () => {
        expect(await job.getState()).toBe("failed");
      });
      expect((await raw.getJob(String(job.id)))?.failedReason).toBeTruthy();
    },
  );

  it("accepts omitted result schemas and typed bulk submissions", async () => {
    const jobs = await app.get(TypedQueue).addBulk([
      { name: "send-email", data: { text: "batch" } },
      { name: "notify", data: { userId: "123" } },
    ]);
    await vi.waitFor(async () => {
      expect(await Promise.all(jobs.map((job) => job.getState()))).toEqual([
        "completed",
        "completed",
      ]);
    });
    expect(handled).toHaveBeenCalledWith("notify", { userId: "123" });
  });
  it("fails a missing named handler without retries or a generic process fallback", async () => {
    const processor = app.get(TypedProcessor);
    const fallback = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(processor, "process", {
      value: fallback,
      configurable: true,
    });
    Object.defineProperty(processor, "processMissingHandler", {
      value: undefined,
      configurable: true,
    });
    try {
      const job = await app
        .get(TypedQueue)
        .add("missing-handler", {}, { attempts: 5 });
      await vi.waitFor(async () => {
        expect(await job.getState()).toBe("failed");
      });
      const stored = await raw.getJob(String(job.id));
      expect(stored?.attemptsMade).toBe(1);
      expect(stored?.failedReason).toContain(
        'No processor method "processMissingHandler"',
      );
      expect(handled).not.toHaveBeenCalled();
      expect(fallback).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(processor, "processMissingHandler");
      Reflect.deleteProperty(processor, "process");
    }
  });
});
