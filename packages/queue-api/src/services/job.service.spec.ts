import { EventEmitter } from "node:events";

import type { EntityManager } from "@mikro-orm/core";
import { User } from "@nest-boot/auth";
import { OrderDirection } from "@nest-boot/graphql-connection";
import { BaseQueue, type QueueManager } from "@nest-boot/queue";
import { RequestContext } from "@nest-boot/request-context";
import { Logger } from "@nestjs/common";
import type { Job as BullmqJob, QueueEventsOptions } from "bullmq";
import { QueueEvents as BullmqQueueEvents } from "bullmq";
import type { Mock } from "vitest";

import { createAuthServices } from "../../test/auth.fixture.js";
import { JobQueue } from "../queues/job.queue.js";
import { JobService } from "./job.service.js";

interface Reader extends EventEmitter {
  name: string;
  opts: QueueEventsOptions;
  run: Mock<() => Promise<void>>;
  close: Mock<() => Promise<void>>;
  waitUntilReady: Mock<() => Promise<void>>;
}
const { readers, findJob } = vi.hoisted(() => ({
  readers: [] as Reader[],
  findJob: vi.fn<(...args: unknown[]) => Promise<BullmqJob | undefined>>(),
}));
vi.mock("bullmq", async (original) => {
  const actual = await original<typeof import("bullmq")>();
  const { EventEmitter } = await import("node:events");
  return {
    ...actual,
    Job: { fromId: findJob },
    QueueEvents: class extends EventEmitter {
      close = vi.fn().mockResolvedValue(undefined);
      run = vi.fn().mockResolvedValue(undefined);
      waitUntilReady = vi.fn().mockResolvedValue(undefined);
      constructor(
        readonly name: string,
        readonly opts: QueueEventsOptions,
      ) {
        super();
        readers.push(this);
      }
    },
  };
});
beforeEach(() => {
  readers.length = 0;
  findJob.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

/**
 * Creates a queue identity without opening Redis connections.
 * @param name - Queue name.
 * @returns Source queue identity.
 */
function source(name: string): BaseQueue {
  const queue = Object.assign(Object.create(BaseQueue.prototype) as BaseQueue, {
    name,
    qualifiedName: `test:${name}`,
    opts: { connection: { host: "127.0.0.1" }, prefix: "test" },
  });
  Object.defineProperty(queue, "queueEvents", {
    value: new BullmqQueueEvents(name, queue.opts),
  });
  return queue;
}
/**
 * Creates the service with registered queues and an observable snapshot sink.
 * @param sources - Validated singleton queues, including the internal queue.
 * @returns Service and snapshot submission mock.
 */
function createService(sources: BaseQueue[]) {
  const add = vi
    .fn<(...args: unknown[]) => Promise<void>>()
    .mockResolvedValue(undefined);
  const upsertJobScheduler = vi.fn().mockResolvedValue(undefined);
  const queue = Object.assign(new EventEmitter(), {
    name: "job",
    add,
    upsertJobScheduler,
  });
  const manager = {
    getQueues: () => sources,
    stop: vi
      .fn<(...args: unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
  const auth = createAuthServices();
  const service = new JobService(
    {} as EntityManager,
    queue as unknown as JobQueue,
    manager as unknown as QueueManager,
    auth.users,
    auth.workspaces,
  );
  return {
    add,
    upsertJobScheduler,
    service,
    manager,
    start: async () => {
      await service.onModuleInit();
    },
  };
}

it("subscribes to existing business readers and skips its own queue", async () => {
  const email = source("email");
  const internal = Object.create(JobQueue.prototype) as JobQueue;
  const { service, start, upsertJobScheduler } = createService([
    email,
    source("reports"),
    internal,
  ]);
  await start();
  expect(upsertJobScheduler).toHaveBeenCalledExactlyOnceWith(
    "cleanup",
    { pattern: "0 0 * * *", tz: "UTC" },
    { name: "cleanup", data: {} },
  );
  expect(readers.map((reader) => reader.name)).toEqual(["email", "reports"]);
  expect(readers[0].listenerCount("waiting")).toBe(1);
  expect(readers.every((reader) => reader.run.mock.calls.length === 0)).toBe(
    true,
  );
  await service.onModuleDestroy();
});

it.each([
  {
    event: "completed",
    args: { returnvalue: { saved: true } },
    expected: {
      status: "completed",
      returnValue: { saved: true },
      finishedAt: 2000,
    },
  },
  {
    event: "failed",
    args: { failedReason: "failed" },
    expected: { status: "failed", failedReason: "failed", finishedAt: 2000 },
  },
])(
  "preserves $event metadata when the original Redis job is gone",
  async ({ event, args, expected }) => {
    const { service, add, start } = createService([source("email")]);
    await start();
    try {
      readers[0].emit(event, { jobId: "42", ...args }, "2000-3");
      await vi.waitFor(() => {
        expect(add).toHaveBeenCalledExactlyOnceWith(
          "sync",
          {
            eventId: "2000-3",
            data: { queue: "email", jobId: "42", ...expected },
          },
          {
            deduplication: {
              id: JSON.stringify(["test:email", "2000-3"]),
              ttl: 86400000,
            },
          },
        );
      });
    } finally {
      await service.onModuleDestroy();
    }
  },
);

it.each(["waiting", "progress"])(
  "captures the stored job and applies the %s event payload",
  async (event) => {
    findJob.mockResolvedValue({
      name: "send",
      data: { userId: "alice" },
      priority: 7,
      progress: 10,
      returnvalue: null,
      failedReason: null,
      timestamp: 1000,
      processedOn: 1500,
      finishedOn: undefined,
      getState: () => Promise.resolve("active"),
    } as unknown as BullmqJob);
    const { service, add, start } = createService([source("email")]);
    await start();
    try {
      readers[0].emit(event, { jobId: "42", data: 80 }, "2000-3");
      await vi.waitFor(() => {
        expect(add).toHaveBeenCalledWith(
          "sync",
          {
            eventId: "2000-3",
            data: {
              queue: "email",
              jobId: "42",
              name: "send",
              data: { userId: "alice" },
              status: event === "waiting" ? "prioritized" : "active",
              progress: event === "waiting" ? 10 : 80,
              returnValue: null,
              failedReason: null,
              createdAt: 1000,
              startedAt: 1500,
              finishedAt: null,
            },
          },
          expect.any(Object),
        );
      });
    } finally {
      await service.onModuleDestroy();
    }
  },
);

it("logs a failed snapshot submission and continues forwarding later events", async () => {
  const log = vi
    .spyOn(Logger.prototype, "error")
    .mockImplementation(() => undefined);
  const { service, add, start } = createService([source("email")]);
  add.mockRejectedValueOnce(new Error("Redis submission failed"));
  await start();
  try {
    readers[0].emit("waiting", { jobId: "1" }, "2000-1");
    await vi.waitFor(() => {
      expect(log).toHaveBeenCalledOnce();
    });
    readers[0].emit("waiting", { jobId: "2" }, "2000-2");
    await vi.waitFor(() => {
      expect(add).toHaveBeenCalledTimes(2);
    });
    expect(add.mock.calls[1][1]).toMatchObject({
      eventId: "2000-2",
      data: { jobId: "2" },
    });
  } finally {
    await service.onModuleDestroy();
  }
});

it("waits for every reader and pending snapshot before reporting a close failure", async () => {
  const sources = [source("email"), source("reports")];
  const { service, add, start } = createService(sources);
  let submit!: () => void;
  add.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        submit = resolve;
      }),
  );
  await start();
  expect(sources[0].queueEvents).toBe(readers[0]);
  expect(sources[1].queueEvents).toBe(readers[1]);
  readers[0].emit("waiting", { jobId: "pending" }, "1000-1");
  await vi.waitFor(() => {
    expect(add).toHaveBeenCalledOnce();
  });

  const failure = new Error("Reader close failed");
  readers[0].close.mockRejectedValueOnce(failure);
  let stopReader!: () => void;
  readers[1].close.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        stopReader = resolve;
      }),
  );
  const closing = service.onModuleDestroy();
  expect(service.onModuleDestroy()).toBe(closing);
  const rejected = expect(closing).rejects.toMatchObject({ errors: [failure] });
  let settled = false;
  void closing.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  try {
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(readers[1].close).toHaveBeenCalledOnce();
    expect(settled).toBe(false);
    stopReader();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    submit();
    await rejected;
    expect(
      readers.every((reader) => reader.close.mock.calls.length === 1),
    ).toBe(true);
  } finally {
    stopReader();
    submit();
    await closing.catch(() => undefined);
  }
});

it("drains source Workers and pending events before stopping the Job Worker", async () => {
  const { service, add, manager, start } = createService([source("email")]);
  let submit!: () => void;
  add.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        submit = resolve;
      }),
  );
  await start();
  readers[0].emit("waiting", { jobId: "pending" }, "1000-1");
  await vi.waitFor(() => {
    expect(add).toHaveBeenCalledOnce();
  });
  const closing = service.onModuleDestroy();
  try {
    await vi.waitFor(() => {
      expect(readers[0].close).toHaveBeenCalledOnce();
    });
    expect(manager.stop).toHaveBeenCalledExactlyOnceWith(["email"]);
    submit();
    await closing;
    expect(manager.stop.mock.calls).toEqual([[["email"]], [["job"]]]);
  } finally {
    submit();
    await closing;
  }
});

it("attempts reader and Job Worker shutdown even when a source Worker fails to close", async () => {
  const { service, manager, start } = createService([source("email")]);
  await start();
  const failure = new Error("Worker shutdown failed");
  manager.stop.mockRejectedValueOnce(failure);
  await expect(service.onModuleDestroy()).rejects.toMatchObject({
    errors: [failure],
  });
  expect(readers[0].close).toHaveBeenCalledOnce();
  expect(manager.stop.mock.calls).toEqual([[["email"]], [["job"]]]);
});

it.each(["id", "queue", "name", "status", "progress", "finishedAt"] as const)(
  "rejects unsupported ordering by %s from direct service callers",
  async (field) => {
    const { service } = createService([]);
    const context = new RequestContext({ type: "http" });
    context.set(User, Object.assign(new User(), { id: "alice" }));
    await expect(
      RequestContext.run(context, () =>
        service.getUserJobConnection({
          first: 10,
          orderBy: { field, direction: OrderDirection.ASC },
        }),
      ),
    ).rejects.toThrow("Jobs can only be ordered by CREATED_AT.");
  },
);
