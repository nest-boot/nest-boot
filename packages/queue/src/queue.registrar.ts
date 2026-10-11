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

import { BaseProcessor } from "./base-processor.js";
import { BaseQueue } from "./base-queue.js";
import {
  PostgresQueueEvents as QueueEvents,
  PostgresWorker as Worker,
} from "./postgres.js";
import type { ProcessorDefinition } from "./processor.decorator.js";
import {
  ON_QUEUE_EVENT,
  ON_WORKER_EVENT,
  PROCESSOR_OPTIONS,
  QUEUE_EVENTS_OPTIONS,
  QUEUE_EVENTS_REF,
  QUEUE_OPTIONS,
  WORKER_REF,
} from "./queue.constants.js";
import { getQueueDefinition } from "./queue.decorator.js";
import { QueueEventsHost } from "./queue-events-host.js";
import type { QueueEventsDefinition } from "./queue-events-listener.decorator.js";
import { runInQueueContext } from "./utils/run-in-queue-context.util.js";

/** Discovers consumers and explicit listeners, and owns their BullMQ transports. */
@Injectable()
export class QueueRegistrar implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueRegistrar.name);
  private readonly scanner = new MetadataScanner();
  private readonly workers = new Set<Worker>();
  private readonly listeners = new Set<QueueEvents>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    const bindings: ({ provider: InstanceWrapper; queue: BaseQueue } & (
      | { definition: ProcessorDefinition; listener: false }
      | { definition: QueueEventsDefinition; listener: true }
    ))[] = [];
    const queues = new Map<string, BaseQueue>();
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
          { ...options, ...connection },
        );
        this.workers.add(worker);
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

  /** Drains workers while application dependencies are still available. */
  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.workers].map((worker) => worker.close()));
    await Promise.all([...this.listeners].map((listener) => listener.close()));
  }
}
