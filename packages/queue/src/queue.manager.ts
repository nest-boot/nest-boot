import {
  type BeforeApplicationShutdown,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleInit,
  type Type,
} from "@nestjs/common";
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import {
  type Job as BullmqJob,
  QueueEvents as BullmqQueueEvents,
  UnrecoverableError,
  Worker as BullmqWorker,
} from "bullmq";

import { getQueueName } from "./decorators/queue.decorator.js";
import { BaseProcessor } from "./processors/base.processor.js";
import {
  PROCESSOR_QUEUE,
  QUEUE_EVENTS_REF,
  QUEUE_NAME,
  WORKER_REF,
} from "./queue.constants.js";
import { BaseQueue } from "./queues/base.queue.js";
import { getProcessMethodName } from "./utils/get-process-method-name.util.js";
import { runInQueueContext } from "./utils/run-in-queue-context.util.js";

interface QueueBinding {
  queue: BaseQueue;
  instance: BaseProcessor;
}

/** Discovers singleton processors and manages their Worker lifecycle. */
@Injectable()
export class QueueManager
  implements OnModuleInit, OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(QueueManager.name);
  private readonly workers = new Set<BullmqWorker>();
  private readonly queues = new Map<string, BaseQueue>();
  private bindings: QueueBinding[] = [];
  private startup?: Promise<string[]>;
  private shutdown?: Promise<void>;
  private readonly lifetime: Promise<void>;
  private resolveStop!: () => void;
  private fail!: (error: unknown) => void;
  private stopping = false;
  private started = false;
  private initialized = false;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly moduleRef: ModuleRef,
  ) {
    this.lifetime = new Promise<void>((resolve, reject) => {
      this.resolveStop = resolve;
      this.fail = reject;
    });
    // A loop may fail before the foreground command starts awaiting it.
    void this.lifetime.catch(() => undefined);
  }

  /** @returns Shutdown notification, rejecting on fatal worker or listener failure. */
  waitForStop(): Promise<void> {
    return this.lifetime;
  }

  /** @returns The validated singleton queues registered in this application. */
  getQueues(): readonly BaseQueue[] {
    this.onModuleInit();
    return [...this.queues.values()];
  }

  /** Starts event readers even in applications without running Workers. */
  async onApplicationBootstrap(): Promise<void> {
    const queues = this.getQueues();
    for (const queue of queues) {
      void queue.queueEvents.run().catch((error: unknown) => {
        this.logger.error(error);
        this.fail(error);
      });
    }
    await Promise.all(
      queues.map((queue) => queue.queueEvents.waitUntilReady()),
    );
  }

  onModuleInit(): void {
    if (this.initialized) {
      return;
    }
    const bindings: QueueBinding[] = [];
    const seen = new Set<object>();
    for (const provider of this.discovery.getProviders()) {
      if (provider.isAlias) {
        continue;
      }
      const target = (
        !provider.metatype || provider.inject
          ? (provider.instance?.constructor ??
            (typeof provider.token === "function" ? provider.token : undefined))
          : provider.metatype
      ) as Type | undefined;
      if (!target) {
        continue;
      }
      const instance = provider.instance as unknown;
      const processorQueue = Reflect.getMetadata(PROCESSOR_QUEUE, target) as
        | Type<BaseQueue>
        | undefined;
      const isQueue =
        Reflect.hasMetadata(QUEUE_NAME, target) ||
        instance instanceof BaseQueue;
      const isProcessor =
        !!processorQueue ||
        instance instanceof BaseProcessor ||
        target.prototype instanceof BaseProcessor;
      if (!isQueue && !isProcessor) {
        continue;
      }
      const expected = isQueue ? BaseQueue : BaseProcessor;
      if (
        !provider.isDependencyTreeStatic() ||
        provider.isTransient ||
        !(instance instanceof expected)
      ) {
        throw new Error(
          `${isQueue ? "Queue" : "Processor"} "${target.name}" must be a singleton ${expected.name} provider.`,
        );
      }
      if (isQueue) {
        const queue = instance as BaseQueue;
        const previous = this.queues.get(queue.name);
        if (previous && previous !== queue) {
          throw new Error(
            `Queue "${queue.name}" has multiple providers. Export and reuse a single queue provider.`,
          );
        }
        this.queues.set(queue.name, queue);
        continue;
      }
      if (seen.has(instance)) {
        continue;
      }
      seen.add(instance);
      if (!processorQueue) {
        throw new Error(
          `Processor "${target.name}" requires @Processor(QueueClass).`,
        );
      }
      const name = getQueueName(processorQueue);
      let queue: BaseQueue | undefined;
      try {
        queue = this.moduleRef.get(processorQueue, { strict: false });
      } catch {
        /* Report the missing provider below. */
      }
      if (!(queue instanceof BaseQueue)) {
        throw new Error(
          `Processor "${target.name}" for queue "${name}" requires ${processorQueue.name} in module providers.`,
        );
      }
      bindings.push({ instance, queue });
    }
    for (const { queue, instance } of bindings) {
      if (
        !(queue instanceof BaseQueue) ||
        this.queues.get(queue.name) !== queue
      ) {
        throw new Error(
          `Processor "${instance.constructor.name}" requires its singleton queue in module providers.`,
        );
      }
    }
    this.bindings = bindings;
    for (const queue of this.queues.values()) {
      const events = new BullmqQueueEvents(queue.name, {
        connection: queue.opts.connection,
        prefix: queue.opts.prefix,
        autorun: false,
      });
      events.on("error", (error) => {
        this.logger.error(error);
      });
      queue[QUEUE_EVENTS_REF] = events;
    }
    this.initialized = true;
  }

  /**
   * Starts consumers for the selected registered queues.
   * @param queueNames - Queue names; omit to run all registered consumers.
   * @returns Names of queues with active consumers.
   */
  start(queueNames?: readonly string[]): Promise<string[]> {
    if (this.stopping) {
      return Promise.reject(new Error("Queue consumers are shutting down."));
    }
    if (this.startup) {
      return Promise.reject(
        new Error("Queue consumers have already been started."),
      );
    }
    const selected = queueNames?.length ? new Set(queueNames) : undefined;
    for (const name of selected ?? []) {
      if (!this.queues.has(name)) {
        return Promise.reject(
          new Error(
            `Unknown queue "${name}". Available queues: ${[...this.queues.keys()].join(", ")}.`,
          ),
        );
      }
    }
    const bindings = this.bindings.filter(
      ({ queue }) => !selected || selected.has(queue.name),
    );
    if (!bindings.length) {
      return Promise.resolve([]);
    }
    this.startup = this.startBindings(bindings);
    return this.startup;
  }

  private async startBindings(bindings: QueueBinding[]): Promise<string[]> {
    try {
      for (const { instance, queue } of bindings) {
        const worker = new BullmqWorker(
          queue.name,
          async (job, token, signal) =>
            await runInQueueContext(job, async () => {
              await queue.validateJobData(job.name, job.data);
              const method = getProcessMethodName(job.name);
              const handler = (instance as unknown as Record<string, unknown>)[
                method
              ];
              if (method === "process" || typeof handler !== "function") {
                throw new UnrecoverableError(
                  `No processor method "${method}" for job "${job.name}" in queue "${queue.name}".`,
                );
              }
              const result = await (
                handler as (
                  job: BullmqJob,
                  token?: string,
                  signal?: AbortSignal,
                ) => Promise<unknown>
              ).call(instance, job, token, signal);
              await queue.validateJobResult(job.name, result);
              return result;
            }),
          {
            ...instance.workerOptions,
            connection: queue.opts.connection,
            prefix: queue.opts.prefix,
            telemetry: queue.opts.telemetry,
            autorun: false,
          },
        );
        instance[WORKER_REF] = worker;
        this.workers.add(worker);
        worker.on("error", (error) => {
          this.logger.error(error);
        });
      }
      await Promise.race([
        Promise.all([...this.workers].map((worker) => worker.waitUntilReady())),
        this.lifetime,
      ]);
      if (this.stopping) {
        return [];
      }
      for (const worker of this.workers) {
        void worker.run().catch((error: unknown) => {
          this.logger.error(error);
          this.fail(error);
        });
      }
      this.started = true;
      return [...new Set(bindings.map(({ queue }) => queue.name))];
    } catch (error) {
      this.shutdown ??= this.closeTransports();
      await this.shutdown;
      throw error;
    }
  }

  /**
   * Drains selected Workers without closing their queues or event readers.
   * @param queueNames - Names to stop; omit to drain every Worker.
   */
  async stop(queueNames?: readonly string[]): Promise<void> {
    const selected = queueNames ? new Set(queueNames) : undefined;
    const workers = [...this.workers].filter(
      (worker) => !selected || selected.has(worker.name),
    );
    const results = await Promise.allSettled(
      workers.map(async (worker) => {
        try {
          await worker.close(!this.started);
        } finally {
          this.workers.delete(worker);
          for (const { instance } of this.bindings) {
            if (instance[WORKER_REF] === worker) {
              instance[WORKER_REF] = undefined;
            }
          }
        }
      }),
    );
    this.throwCloseFailures(results);
  }

  private throwCloseFailures(results: PromiseSettledResult<unknown>[]): void {
    const failures = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);
    if (failures.length === 1) {
      throw failures[0];
    }
    if (failures.length) {
      throw new AggregateError(failures, "Failed to close queue transports.");
    }
  }

  private async closeTransports(): Promise<void> {
    const results: PromiseSettledResult<unknown>[] = await Promise.allSettled([
      this.stop(),
    ]);
    results.push(
      ...(await Promise.allSettled(
        [...this.queues.values()].map(async (queue) => {
          try {
            await queue[QUEUE_EVENTS_REF]?.close();
          } finally {
            queue[QUEUE_EVENTS_REF] = undefined;
          }
        }),
      )),
    );
    this.throwCloseFailures(results);
  }

  /** Drains remaining Workers after extensions have flushed their event handling. */
  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    this.resolveStop();
    this.shutdown ??= this.closeTransports();
    await this.shutdown;
  }
}
