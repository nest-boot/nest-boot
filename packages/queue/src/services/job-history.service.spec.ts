import { EntityManager } from "@mikro-orm/core";
import { WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Job, JobState, Queue } from "bullmq";
import type { Mock } from "vitest";

import { Job as PersistedJob } from "../entities/job.entity.js";
import { JobStatus } from "../enums/job-status.enum.js";
import { JobHistoryOptions } from "../job-history-options.interface.js";
import { JOB_HISTORY_OPTIONS } from "../queue.constants.js";
import { JobHistoryService } from "./job-history.service.js";

class TestWorkerHost extends WorkerHost {
  async process(): Promise<void> {
    await Promise.resolve();
  }
}

interface TestWorker {
  close: Mock;
  name: string;
  qualifiedName: string;
  on: Mock;
  off: Mock;
}

type WorkerHostWithMock = Omit<TestWorkerHost, "worker"> & {
  readonly worker: TestWorker;
};

type WorkerEventCall = [string, (job?: Job) => void];

/**
 * Returns job configured for the test.
 * @param state - Queue job state reported by the fixture.
 * @param overrides - Fixture values that replace the defaults.
 * @returns Job configured for the test.
 */
function createJob(
  state: JobState | "unknown",
  overrides: Partial<Job> = {},
): Job {
  return {
    id: "42",
    queueName: "email",
    name: "send-email",
    data: { to: "user@example.com" },
    returnvalue: { accepted: true },
    failedReason: undefined,
    priority: 3,
    progress: 50,
    processedOn: Date.UTC(2026, 0, 1, 1),
    finishedOn: Date.UTC(2026, 0, 1, 2),
    timestamp: Date.UTC(2026, 0, 1),
    getState: vi.fn().mockResolvedValue(state),
    ...overrides,
  } as unknown as Job;
}

/**
 * Returns test service and its mocked dependencies.
 * @param options - Configuration for this operation.
 * @param providers - Dependency injection providers to register.
 * @returns Test service and its mocked dependencies.
 */
async function createService(
  options: Partial<JobHistoryOptions> = {},
  providers: unknown[] = [],
) {
  const fork = {
    nativeDelete: vi.fn(),
    upsert: vi.fn(),
  };
  const em = {
    fork: vi.fn(() => fork),
  } as unknown as EntityManager;
  const getProviders = vi.fn(() =>
    providers.map((provider) => ({ instance: provider })),
  );
  const discoveryService = {
    getProviders,
  } as unknown as DiscoveryService;
  const moduleRef = await Test.createTestingModule({
    providers: [
      JobHistoryService,
      {
        provide: DiscoveryService,
        useValue: discoveryService,
      },
      {
        provide: EntityManager,
        useValue: em,
      },
      {
        provide: JOB_HISTORY_OPTIONS,
        useValue: {
          ...options,
        },
      },
    ],
  }).compile();

  return {
    discoveryService,
    em,
    fork,
    getProviders,
    service: moduleRef.get(JobHistoryService),
  };
}

/**
 * Returns queue configured for the test.
 * @param name - Name used to identify the resource.
 * @param prefix - Redis key prefix for the queue.
 * @returns Queue configured for the test.
 */
function createQueue(name: string, prefix = "bull") {
  return Object.defineProperties(Object.create(Queue.prototype), {
    name: { value: name },
    qualifiedName: { value: `${prefix}:${name}` },
    on: { value: vi.fn() },
    off: { value: vi.fn() },
  }) as Queue & { on: Mock; off: Mock };
}

/**
 * Returns worker host configured for the test.
 * @param name - Name used to identify the resource.
 * @param prefix - Redis key prefix for the queue.
 * @returns Worker host configured for the test.
 */
function createWorkerHost(name: string, prefix = "bull"): WorkerHostWithMock {
  const workerHost = new TestWorkerHost();
  const worker: TestWorker = {
    close: vi.fn().mockResolvedValue(undefined),
    name,
    qualifiedName: `${prefix}:${name}`,
    on: vi.fn(),
    off: vi.fn(),
  };

  Object.defineProperty(workerHost, "_worker", {
    configurable: true,
    value: worker,
  });

  return workerHost as unknown as WorkerHostWithMock;
}

describe("JobHistoryService", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(["waiting", "active", "progress", "completed", "failed"])(
    "logs %s event persistence failures and allows later events to recover",
    async (event) => {
      const queue = createQueue("email");
      const worker = createWorkerHost("email");
      const { service, fork } = await createService({}, [queue, worker]);
      const error = new Error("Database unavailable");
      fork.upsert.mockRejectedValueOnce(error).mockResolvedValue(undefined);
      const log = vi
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);
      service.registerQueue(queue);
      service.onApplicationBootstrap();
      const calls = (
        event === "waiting" ? queue.on.mock.calls : worker.worker.on.mock.calls
      ) as WorkerEventCall[];
      const handler = calls.find(([name]) => name === event)?.[1];
      if (!handler) throw new Error(`Missing ${event} handler`);
      const job = createJob("waiting");
      handler(job);
      await vi.waitFor(() => {
        expect(log).toHaveBeenCalledWith(
          expect.stringContaining("email:42"),
          error.stack,
        );
      });
      handler(job);
      await vi.waitFor(() => {
        expect(fork.upsert).toHaveBeenCalledTimes(2);
      });
      expect(log).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps awaited upsert failures observable to direct callers", async () => {
    const { service, fork } = await createService();
    const error = new Error("Database unavailable");
    fork.upsert.mockRejectedValue(error);
    await expect(
      service.upsertJob(createJob("waiting"), "waiting"),
    ).rejects.toBe(error);
  });

  describe("convertJobToEntityData", () => {
    it("should convert a BullMQ job to entity data", async () => {
      const { service } = await createService();

      await expect(
        service.convertJobToEntityData(createJob("completed"), "waiting"),
      ).resolves.toMatchObject({
        id: "email:42",
        queueName: "email",
        name: "send-email",
        data: { to: "user@example.com" },
        returnValue: { accepted: true },
        failedReason: null,
        priority: 3,
        progress: 50,
        status: JobStatus.COMPLETED,
        startedAt: new Date(Date.UTC(2026, 0, 1, 1)),
        finishedAt: new Date(Date.UTC(2026, 0, 1, 2)),
        createdAt: new Date(Date.UTC(2026, 0, 1)),
        updatedAt: expect.any(Date),
      });
    });

    it("should use the event state when BullMQ returns unknown", async () => {
      const { service } = await createService({
        convertJobToEntityData: () => ({ name: "custom-name" }),
      });

      await expect(
        service.convertJobToEntityData(
          createJob("unknown", {
            data: undefined,
            id: undefined,
            returnvalue: undefined,
            failedReason: "failed",
            processedOn: undefined,
            finishedOn: undefined,
          }),
          "failed",
        ),
      ).resolves.toMatchObject({
        id: "email:",
        data: null,
        returnValue: null,
        failedReason: "failed",
        status: JobStatus.FAILED,
        startedAt: null,
        finishedAt: null,
        name: "custom-name",
      });
    });
  });

  it("should upsert converted job data by id", async () => {
    const { fork, service } = await createService();
    const job = createJob("waiting");

    await service.upsertJob(job, "waiting");

    expect(fork.upsert).toHaveBeenCalledWith(
      PersistedJob,
      expect.objectContaining({
        id: "email:42",
        status: JobStatus.WAITING,
      }),
      {
        onConflictFields: ["id"],
      },
    );
  });

  it("should delete history jobs older than the configured ttl", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-31T00:00:00.000Z"));
    const { fork, service } = await createService({
      jobTTL: 1000,
    });

    await service.cleanHistoryJobs();

    expect(fork.nativeDelete).toHaveBeenCalledWith(PersistedJob, {
      updatedAt: {
        $lt: new Date("2026-01-30T23:59:59.000Z"),
      },
    });
  });

  it("cleans history hourly without ScheduleModule, catches failures, and stops on shutdown", async () => {
    vi.useFakeTimers();
    const { service, fork } = await createService();
    const logger = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    fork.nativeDelete.mockRejectedValueOnce(new Error("database unavailable"));
    service.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(logger).toHaveBeenCalledWith(
      "Failed to clean job history",
      expect.any(Error),
    );
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(fork.nativeDelete).toHaveBeenCalledTimes(2);
    await service.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(fork.nativeDelete).toHaveBeenCalledTimes(2);
  });

  it("detaches listeners and drains pending history writes during shutdown", async () => {
    const queue = createQueue("email");
    const worker = createWorkerHost("email");
    const { service } = await createService({}, [queue, worker]);
    let finishWorker!: () => void;
    worker.worker.close.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishWorker = resolve;
        }),
    );
    let finishWrite!: () => void;
    vi.spyOn(service, "upsertJob").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        }),
    );
    service.registerQueue(queue);
    service.onApplicationBootstrap();
    queue.on.mock.calls[0][1](createJob("waiting"));
    let closed = false;
    const closing = service.onModuleDestroy().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);
    expect(worker.worker.close).toHaveBeenCalledOnce();
    expect(queue.off.mock.calls).toHaveLength(0);
    expect(worker.worker.off).not.toHaveBeenCalled();
    finishWorker();
    await vi.waitFor(() => {
      expect(queue.off.mock.calls).toContainEqual([
        "waiting",
        queue.on.mock.calls[0][1],
      ]);
    });
    expect(worker.worker.off).toHaveBeenCalledTimes(4);
    expect(closed).toBe(false);
    finishWrite();
    await closing;
    expect(closed).toBe(true);
  });

  it("observes only opted-in queues and their matching workers", async () => {
    const emailQueue = createQueue("email");
    const ignoredQueue = createQueue("ignored");
    const emailWorkerHost = createWorkerHost("email");
    const ignoredWorkerHost = createWorkerHost("ignored");
    const otherPrefixWorker = createWorkerHost("email", "other");
    const job = createJob("waiting");
    const { getProviders, service } = await createService({}, [
      emailQueue,
      ignoredQueue,
      emailWorkerHost,
      ignoredWorkerHost,
      otherPrefixWorker,
      {},
    ]);
    const upsertJob = vi.spyOn(service, "upsertJob").mockResolvedValue();

    service.registerQueue(emailQueue);
    service.onApplicationBootstrap();

    expect(getProviders).toHaveBeenCalledTimes(1);
    expect(emailQueue.on.mock.calls).toContainEqual([
      "waiting",
      expect.any(Function),
    ]);
    expect(ignoredQueue.on.mock.calls).toHaveLength(0);
    expect(emailWorkerHost.worker.on).toHaveBeenCalledWith(
      "active",
      expect.any(Function),
    );
    expect(emailWorkerHost.worker.on).toHaveBeenCalledWith(
      "progress",
      expect.any(Function),
    );
    expect(emailWorkerHost.worker.on).toHaveBeenCalledWith(
      "completed",
      expect.any(Function),
    );
    expect(emailWorkerHost.worker.on).toHaveBeenCalledWith(
      "failed",
      expect.any(Function),
    );
    expect(ignoredWorkerHost.worker.on).not.toHaveBeenCalled();
    expect(otherPrefixWorker.worker.on).not.toHaveBeenCalled();

    const queueWaitingHandler = emailQueue.on.mock.calls.find(
      ([event]) => event === "waiting",
    )?.[1];
    const workerHandlers = Object.fromEntries(
      (emailWorkerHost.worker.on.mock.calls as WorkerEventCall[]).map(
        ([event, handler]) => [event, handler],
      ),
    ) as Record<string, (job?: Job) => void>;

    queueWaitingHandler(job);
    workerHandlers.active(job);
    workerHandlers.progress(job);
    workerHandlers.completed(job);
    workerHandlers.failed(job);
    workerHandlers.failed(undefined);

    expect(upsertJob).toHaveBeenCalledWith(job, "waiting");
    expect(upsertJob).toHaveBeenCalledWith(job, "active");
    expect(upsertJob).toHaveBeenCalledWith(job, "completed");
    expect(upsertJob).toHaveBeenCalledWith(job, "failed");
    expect(upsertJob).toHaveBeenCalledTimes(5);
  });
});
