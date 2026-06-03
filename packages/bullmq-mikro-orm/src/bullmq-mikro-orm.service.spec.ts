import { EntityData, EntityManager } from "@mikro-orm/core";
import { WorkerHost } from "@nest-boot/bullmq";
import { DiscoveryService } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Job, JobState, Queue } from "bullmq";

import { MODULE_OPTIONS_TOKEN } from "./bullmq-mikro-orm.module-definition";
import { BullMQMikroORMService } from "./bullmq-mikro-orm.service";
import { BullMQMikroORMModuleOptions } from "./bullmq-mikro-orm-module-options.interface";
import { JobEntity } from "./entities/job.entity";
import { JobStatus } from "./enums/job-status.enum";

class TestWorkerHost extends WorkerHost {
  async process(): Promise<void> {
    await Promise.resolve();
  }
}

interface TestWorker {
  name: string;
  on: jest.Mock;
}

type WorkerHostWithMock = TestWorkerHost & {
  readonly worker: TestWorker;
};

type WorkerEventCall = [string, (job?: Job) => void];

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
    getState: jest.fn().mockResolvedValue(state),
    ...overrides,
  } as unknown as Job;
}

async function createService(
  options: Partial<BullMQMikroORMModuleOptions> = {},
  providers: unknown[] = [],
) {
  const fork = {
    nativeDelete: jest.fn(),
    upsert: jest.fn(),
  };
  const em = {
    fork: jest.fn(() => fork),
  } as unknown as EntityManager;
  const getProviders = jest.fn(() =>
    providers.map((provider) => ({ instance: provider })),
  );
  const discoveryService = {
    getProviders,
  } as unknown as DiscoveryService;
  const moduleRef = await Test.createTestingModule({
    providers: [
      BullMQMikroORMService,
      {
        provide: DiscoveryService,
        useValue: discoveryService,
      },
      {
        provide: EntityManager,
        useValue: em,
      },
      {
        provide: MODULE_OPTIONS_TOKEN,
        useValue: {
          jobEntity: JobEntity,
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
    service: moduleRef.get(BullMQMikroORMService),
  };
}

function createQueue(name: string) {
  const queue = Object.create(Queue.prototype) as Queue & {
    name: string;
    on: jest.Mock;
  };
  queue.name = name;
  queue.on = jest.fn();

  return queue;
}

function createWorkerHost(name: string): WorkerHostWithMock {
  const workerHost = new TestWorkerHost();
  const worker: TestWorker = {
    name,
    on: jest.fn(),
  };

  Object.defineProperty(workerHost, "_worker", {
    configurable: true,
    value: worker,
  });

  return workerHost as WorkerHostWithMock;
}

describe("BullMQMikroORMService", () => {
  afterEach(() => {
    jest.useRealTimers();
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
        convertJobToEntityData: () =>
          ({
            tenantId: "tenant-1",
          }) as EntityData<JobEntity>,
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
        tenantId: "tenant-1",
      });
    });
  });

  it("should upsert converted job data by id", async () => {
    const { fork, service } = await createService();
    const job = createJob("waiting");

    await service.upsertJob(job, "waiting");

    expect(fork.upsert).toHaveBeenCalledWith(
      JobEntity,
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
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-31T00:00:00.000Z"));
    const { fork, service } = await createService({
      jobTTL: 1000,
    });

    await service.cleanHistoryJobs();

    expect(fork.nativeDelete).toHaveBeenCalledWith(JobEntity, {
      updatedAt: {
        $lt: new Date("2026-01-30T23:59:59.000Z"),
      },
    });
  });

  it("should subscribe included queues and workers on application bootstrap", async () => {
    const emailQueue = createQueue("email");
    const ignoredQueue = createQueue("ignored");
    const emailWorkerHost = createWorkerHost("email");
    const ignoredWorkerHost = createWorkerHost("ignored");
    const job = createJob("waiting");
    const { getProviders, service } = await createService(
      {
        excludeQueues: ["ignored"],
        includeQueues: ["email", "ignored"],
      },
      [emailQueue, ignoredQueue, emailWorkerHost, ignoredWorkerHost, {}],
    );
    const upsertJob = jest.spyOn(service, "upsertJob").mockResolvedValue();

    service.onApplicationBootstrap();

    expect(getProviders).toHaveBeenCalledTimes(1);
    expect(emailQueue.on).toHaveBeenCalledWith("waiting", expect.any(Function));
    expect(ignoredQueue.on).not.toHaveBeenCalled();
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
