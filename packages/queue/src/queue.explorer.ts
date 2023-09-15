import { RequestContext } from "@nest-boot/request-context";
import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import {
  createContextId,
  DiscoveryService,
  MetadataScanner,
  ModuleRef,
  Reflector,
} from "@nestjs/core";
import { Injector } from "@nestjs/core/injector/injector";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { MetricsTime, Worker } from "bullmq";

import {
  ConsumerDecorator,
  ConsumerOptions,
} from "./decorators/consumer.decorator";
import { type ProcessorFunction } from "./interfaces/processor-function.interface";
import { type ProcessorMetadataOptions } from "./interfaces/processor-metadata-options.interface";
import { QueueConsumer } from "./interfaces/queue-consumer.interface";
import { Queue } from "./queue";
import { PROCESSOR_METADATA_KEY } from "./queue.module-definition";

@Injectable()
export class QueueExplorer implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QueueExplorer.name);
  private readonly injector = new Injector();

  readonly processors = new Map<
    string,
    ProcessorMetadataOptions & { processor: ProcessorFunction }
  >();

  readonly queues = new Map<string, Queue>();

  readonly workers = new Map<string, Worker>();

  readonly consumers = new Map<
    string,
    ConsumerOptions & { consume: QueueConsumer["consume"] }
  >();

  constructor(
    private readonly reflector: Reflector,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly moduleRef: ModuleRef,
  ) {}

  discoveryJobs(): void {
    this.discoveryService.getProviders().forEach((wrapper) => {
      const { host, instance } = wrapper;

      if (typeof instance === "object" && instance !== null) {
        this.metadataScanner
          .getAllMethodNames(Object.getPrototypeOf(instance))
          .forEach((key) => {
            if (
              typeof host !== "undefined" &&
              typeof instance.constructor.name === "string"
            ) {
              const metadataOptions =
                this.reflector.get<ProcessorMetadataOptions>(
                  PROCESSOR_METADATA_KEY,
                  instance[key],
                );

              if (typeof metadataOptions !== "undefined") {
                const isRequestScoped = !wrapper.isDependencyTreeStatic();

                this.processors.set(metadataOptions.name, {
                  ...metadataOptions,
                  processor: isRequestScoped
                    ? async (job) => {
                        const contextId = createContextId();

                        const contextInstance =
                          await this.injector.loadPerContext(
                            instance,
                            host,
                            host.providers,
                            contextId,
                          );

                        return contextInstance[key](job);
                      }
                    : (job) => instance[key](job),
                });

                this.logger.log(`Processor ${metadataOptions.name} discovered`);
              }
            }
          });
      }
    });
  }

  discoveryConsumer(): void {
    this.discoveryService
      .getProviders()
      .forEach((wrapper: InstanceWrapper<QueueConsumer>) => {
        const { host, instance } = wrapper;

        if (
          typeof host !== "undefined" &&
          typeof instance?.constructor !== "undefined"
        ) {
          const consumerOptions = this.reflector.get(
            ConsumerDecorator,
            instance?.constructor,
          );

          if (typeof consumerOptions !== "undefined") {
            const isRequestScoped = !wrapper.isDependencyTreeStatic();

            this.consumers.set(consumerOptions.name, {
              ...consumerOptions,
              consume: isRequestScoped
                ? async (job) => {
                    const contextId = createContextId();

                    this.moduleRef.registerRequestByContextId(job, contextId);

                    const contextInstance = await this.injector.loadPerContext(
                      instance,
                      host,
                      host.providers,
                      contextId,
                    );

                    await contextInstance.consume(job);
                  }
                : instance.consume.bind(instance),
            });
          }
        }
      });
  }

  discoveryQueues(): void {
    this.discoveryService.getProviders().forEach((wrapper) => {
      const { instance } = wrapper;

      if (instance instanceof Queue) {
        this.queues.set(instance.name, instance);

        this.logger.log(`Queue ${instance.name} discovered`);
      }
    });
  }

  async processor(...args: Parameters<ProcessorFunction>): Promise<void> {
    const [job] = args;

    const ctx = new RequestContext();
    ctx.set("job", job);

    const processor = this.processors.get(job.name)?.processor;

    if (typeof processor === "function") {
      await Promise.race([
        RequestContext.run(ctx, async () => {
          await processor(...args);
        }),
        ...(typeof job.opts.timeout !== "undefined"
          ? [
              new Promise<void>((resolve, reject) => {
                setTimeout(() => {
                  reject(new Error("Job processing timeout"));
                }, job.opts.timeout);
              }),
            ]
          : []),
      ]);
    }

    const consumer = this.consumers.get(job.name);

    if (typeof consumer !== "undefined") {
      await Promise.race([
        RequestContext.run(ctx, async () => {
          await consumer.consume(job);
        }),
        ...(typeof job.opts.timeout !== "undefined"
          ? [
              new Promise<void>((resolve, reject) => {
                setTimeout(() => {
                  reject(new Error("Job processing timeout"));
                }, job.opts.timeout);
              }),
            ]
          : []),
      ]);
    }
  }

  onModuleInit(): void {
    this.discoveryJobs();
    this.discoveryQueues();
    this.discoveryConsumer();

    [...this.queues.entries()].forEach(([name, queue]) => {
      const worker = new Worker(name, this.processor.bind(this), {
        autorun: false,
        metrics: {
          maxDataPoints: MetricsTime.ONE_MONTH,
        },
        ...queue.opts,
      });

      // worker.on("failed", (job, err) => {
      //   this.logger.error("queue job failed", {
      //     err,
      //     ...(typeof job !== "undefined"
      //       ? { queueName: job.queueName, jobName: job.name, jobId: job.id }
      //       : {}),
      //   });
      // });

      this.workers.set(name, worker);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(
      [...this.queues.entries()].map(async ([name, queue]) => {
        await queue.close();

        this.logger.log(`Queue ${name} closed`);
      }),
    );

    await Promise.all(
      [...this.workers.entries()].map(async ([name, worker]) => {
        await worker.close();

        this.logger.log(`Worker ${name} closed`);
      }),
    );
  }
}
