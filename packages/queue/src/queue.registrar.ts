import type { EventEmitter } from "node:events";

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
  type Type,
} from "@nestjs/common";
import {
  ContextIdFactory,
  DiscoveryService,
  MetadataScanner,
  ModuleRef,
} from "@nestjs/core";
import type { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";

import { BaseProcessor } from "./base.processor.js";
import { BaseQueue } from "./base.queue.js";
import type { ProcessorDefinition } from "./decorators/processor.decorator.js";
import { getQueueDefinition } from "./decorators/queue.decorator.js";
import type { QueueEventsDefinition } from "./decorators/queue-events-listener.decorator.js";
import {
  PostgresQueueEvents as QueueEvents,
  PostgresWorker as Worker,
} from "./postgres.js";
import {
  ON_QUEUE_EVENT,
  ON_WORKER_EVENT,
  PROCESSOR_OPTIONS,
  QUEUE_EVENTS_OPTIONS,
  QUEUE_EVENTS_REF,
  QUEUE_OPTIONS,
  WORKER_REF,
} from "./queue.constants.js";
import { QueueEventsHost } from "./queue-events-host.js";
import { runInQueueContext } from "./utils/run-in-queue-context.util.js";

type QueueBinding = { provider: InstanceWrapper; queue: BaseQueue } & (
  | { definition: ProcessorDefinition; listener: false }
  | { definition: QueueEventsDefinition; listener: true }
);

/** Discovers consumers and explicit listeners, and owns their BullMQ transports. */
@Injectable()
export class QueueRegistrar implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueRegistrar.name);
  private readonly scanner = new MetadataScanner();
  private readonly workers = new Set<Worker>();
  private readonly runnableWorkers = new Set<Worker>();
  private readonly listeners = new Set<QueueEvents>();
  private readonly queues = new Map<string, BaseQueue>();
  private bindings: QueueBinding[] = [];
  private startup?: Promise<string[]>;
  private shutdown?: Promise<void>;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Lists registered queues explicitly included in API reads.
   * @returns Queue names allowed by their declarations.
   */
  getExposedQueueNames(): string[] {
    return [...this.queues.values()]
      .filter(
        (queue) =>
          getQueueDefinition(queue.constructor as Type<BaseQueue>).expose ===
          true,
      )
      .map((queue) => queue.name);
  }

  onModuleInit(): void {
    const bindings: QueueBinding[] = [];
    const queues = this.queues;
    const seen = new Set<unknown>();
    for (const provider of this.discovery.getProviders()) {
      if (provider.isAlias) continue;
      const target = (
        !provider.metatype || provider.inject
          ? (provider.instance?.constructor ??
            (typeof provider.token === "function" ? provider.token : undefined))
          : provider.metatype
      ) as Type | undefined;
      if (!target) continue;
      if (
        Reflect.hasMetadata(QUEUE_OPTIONS, target) &&
        (!provider.isDependencyTreeStatic() ||
          provider.isTransient ||
          !(provider.instance instanceof BaseQueue))
      ) {
        throw new Error(
          `Queue "${target.name}" must be a singleton BaseQueue provider.`,
        );
      }
      if (provider.instance instanceof BaseQueue) {
        const queue = provider.instance;
        const previous = queues.get(queue.name);
        if (previous && previous !== queue)
          throw new Error(
            `Queue "${queue.name}" has multiple providers. Export and reuse a single queue provider.`,
          );
        queues.set(queue.name, queue);
      }
      const processor = Reflect.getMetadata(PROCESSOR_OPTIONS, target) as
        | ProcessorDefinition
        | undefined;
      const events = Reflect.getMetadata(QUEUE_EVENTS_OPTIONS, target) as
        | QueueEventsDefinition
        | undefined;
      const definition = processor ?? events;
      if (!definition || seen.has(provider.instance ?? provider)) continue;
      seen.add(provider.instance ?? provider);
      const { name } = getQueueDefinition(definition.queue);
      let queue: BaseQueue | undefined;
      try {
        queue = this.moduleRef.get(definition.queue, { strict: false });
      } catch {
        /* Report a useful missing declaration error below. */
      }
      if (!(queue instanceof BaseQueue)) {
        throw new Error(
          `Processor or listener "${target.name}" for queue "${name}" requires ${definition.queue.name} in module providers.`,
        );
      }
      if (
        processor &&
        !(provider.instance instanceof BaseProcessor) &&
        !(target.prototype instanceof BaseProcessor)
      )
        throw new Error(
          `Processor "${target.name}" must extend BaseProcessor.`,
        );
      if (
        events &&
        (!(provider.instance instanceof QueueEventsHost) ||
          !provider.isDependencyTreeStatic() ||
          provider.isTransient)
      )
        throw new Error(
          `Queue listener "${target.name}" must be a singleton QueueEventsHost.`,
        );
      if (processor)
        bindings.push({
          provider,
          definition: processor,
          queue,
          listener: false,
        });
      else if (events)
        bindings.push({ provider, definition: events, queue, listener: true });
    }
    this.bindings = bindings;
  }

  /**
   * Starts consumers and event listeners for the selected registered queues.
   * @param queueNames - Queue names; omit to run all registered consumers.
   * @returns Names of queues with active consumers or listeners.
   */
  start(queueNames?: readonly string[]): Promise<string[]> {
    if (this.startup)
      return Promise.reject(
        new Error("Queue consumers have already been started."),
      );
    const selected = queueNames?.length ? new Set(queueNames) : undefined;
    for (const name of selected ?? []) {
      if (!this.queues.has(name))
        return Promise.reject(
          new Error(
            `Unknown queue "${name}". Available queues: ${[...this.queues.keys()].join(", ")}.`,
          ),
        );
    }
    const bindings = this.bindings.filter(
      ({ queue }) => !selected || selected.has(queue.name),
    );
    this.startup = this.startBindings(bindings);
    return this.startup;
  }

  private async startBindings(bindings: QueueBinding[]): Promise<string[]> {
    try {
      // Validate every binding before constructing any worker or stream reader.
      for (const { provider, definition, queue, listener } of bindings) {
        const connection = {
          connection: queue.opts.connection,
          telemetry: queue.opts.telemetry,
        };
        if (listener) {
          const events = new QueueEvents(queue.name, {
            ...definition.options,
            ...connection,
            autorun: false,
          });
          this.listeners.add(events);
          const instance = provider.instance as QueueEventsHost;
          instance[QUEUE_EVENTS_REF] = events;
          this.bindEvents(instance, events, ON_QUEUE_EVENT);
        } else {
          const instance = provider.instance as BaseProcessor;
          const scoped =
            !provider.isDependencyTreeStatic() || provider.isTransient;
          // Resolve scoped consumers in their declaring module. Capture it once
          // so each job only needs to create its context and resolve the consumer.
          const localRef = provider.host?.providers.get(ModuleRef)
            ?.instance as ModuleRef;
          const options = { ...definition.options };
          delete options.scope;
          delete options.durable;
          const worker = new Worker(
            queue.name,
            async (job, token, signal) =>
              await runInQueueContext({ job }, async () => {
                let consumer = instance;
                if (scoped) {
                  const context = ContextIdFactory.getByRequest(job);
                  this.moduleRef.registerRequestByContextId(job, context);
                  consumer = await localRef.resolve<BaseProcessor>(
                    provider.token,
                    context,
                  );
                  if (!(consumer instanceof BaseProcessor))
                    throw new Error(
                      `Processor "${String(provider.name)}" must resolve to BaseProcessor.`,
                    );
                  consumer[WORKER_REF] = worker;
                }
                return await consumer.process(job, token, signal);
              }),
            { ...options, ...connection, autorun: false },
          );
          this.workers.add(worker);
          if (definition.options.autorun !== false)
            this.runnableWorkers.add(worker);
          if (instance) instance[WORKER_REF] = worker;
          if (!scoped) this.bindEvents(instance, worker, ON_WORKER_EVENT);
          else {
            worker.on("error", (error) => {
              this.logger.error(error);
            });
            this.logger.warn(
              `Worker event handlers on scoped processor "${String(provider.name)}" are not registered.`,
            );
          }
        }
      }
      await Promise.all([
        ...[...this.workers].map((worker) => worker.waitUntilReady()),
        ...[...this.listeners].map((listener) => listener.waitUntilReady()),
      ]);
      for (const { provider, listener } of bindings) {
        if (
          !listener &&
          provider.isDependencyTreeStatic() &&
          !provider.isTransient &&
          provider.instance instanceof BaseProcessor
        ) {
          await provider.instance.onQueueStart?.();
        }
      }
      for (const { provider, definition, listener } of bindings) {
        if (listener && definition.options.autorun !== false) {
          void (provider.instance as QueueEventsHost).queueEvents
            .run()
            .catch((error: unknown) => {
              this.logger.error(error);
            });
        }
      }
      for (const worker of this.runnableWorkers) {
        void worker.run().catch((error: unknown) => {
          this.logger.error(error);
        });
      }
      return [...new Set(bindings.map(({ queue }) => queue.name))];
    } catch (error) {
      await this.closeTransports();
      throw error;
    }
  }

  private bindEvents(
    instance: object,
    transport: EventEmitter,
    metadata: symbol,
  ): void {
    transport.on("error", (error) => {
      this.logger.error(error);
    });
    for (const key of this.scanner.getAllMethodNames(
      Object.getPrototypeOf(instance),
    )) {
      const handler = (instance as Record<string, (...args: any[]) => unknown>)[
        key
      ];
      const event = Reflect.getMetadata(metadata, handler) as
        | string
        | undefined;
      if (event) transport.on(event, handler.bind(instance));
    }
  }

  private async closeTransports(): Promise<void> {
    try {
      await Promise.all([...this.workers].map((worker) => worker.close()));
    } finally {
      await Promise.all(
        [...this.listeners].map((listener) => listener.close()),
      );
      this.workers.clear();
      this.runnableWorkers.clear();
      this.listeners.clear();
      for (const { provider, listener } of this.bindings) {
        if (listener)
          (provider.instance as QueueEventsHost)[QUEUE_EVENTS_REF] = undefined;
        else if (provider.instance)
          (provider.instance as BaseProcessor)[WORKER_REF] = undefined;
      }
    }
  }

  /** Drains workers while application dependencies are still available. */
  async onModuleDestroy(): Promise<void> {
    await this.startup?.catch(() => undefined);
    this.shutdown ??= this.closeTransports();
    await this.shutdown;
  }
}
