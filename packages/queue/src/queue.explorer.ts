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
  ModuleRef,
  Reflector,
} from "@nestjs/core";
import { Injector } from "@nestjs/core/injector/injector";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { MetricsTime, Worker } from "bullmq";

import { ConsumerDecorator, ProcessorDecorator } from "./decorators";
import { JobStatus } from "./enums";
import {
  Job,
  JobProcessor,
  type ProcessorFunction,
  QueueConsumer,
} from "./interfaces";
import { JobEntityService } from "./job-entity.service";
import { Queue } from "./queue";
import { wrapTimeout } from "./utils";

@Injectable()
export class QueueExplorer implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QueueExplorer.name);
  private readonly injector = new Injector();

  readonly queueMap = new Map<string, Queue>();

  readonly workerMap = new Map<string, Worker>();

  readonly consumerMap = new Map<string, ProcessorFunction>();

  readonly processorMap = new Map<string, Map<string, ProcessorFunction>>();

  constructor(
    private readonly reflector: Reflector,
    private readonly discoveryService: DiscoveryService,
    private readonly moduleRef: ModuleRef,
    private readonly jobEntityService: JobEntityService,
  ) {}

  discoveryQueues(): void {
    this.discoveryService.getProviders().forEach((wrapper) => {
      const { instance } = wrapper;

      if (instance instanceof Queue) {
        this.queueMap.set(instance.name, instance);

        this.logger.log(`Queue ${instance.name} discovered`);
      }
    });
  }

  discoveryConsumers(): void {
    this.discoveryService
      .getProviders()
      .forEach((wrapper: InstanceWrapper<QueueConsumer>) => {
        const { host, instance } = wrapper;

        if (
          typeof host !== "undefined" &&
          typeof instance?.constructor !== "undefined"
        ) {
          const metadata = this.reflector.get(
            ConsumerDecorator,
            instance?.constructor,
          );

          if (typeof metadata !== "undefined") {
            const queue = this.queueMap.get(metadata.queue);

            if (typeof queue === "undefined") {
              throw new Error(
                `Queue ${metadata.queue} not found for consumer ${instance?.constructor.name}`,
              );
            }

            const isRequestScoped = !wrapper.isDependencyTreeStatic();

            this.consumerMap.set(
              metadata.queue,
              this.wrapRequestContext(
                wrapTimeout(
                  isRequestScoped
                    ? async (job) => {
                        const contextId = createContextId();

                        this.moduleRef.registerRequestByContextId(
                          job,
                          contextId,
                        );

                        const contextInstance =
                          await this.injector.loadPerContext(
                            instance,
                            host,
                            host.providers,
                            contextId,
                          );

                        return await contextInstance.consume(job);
                      }
                    : instance.consume.bind(instance),
                ),
              ),
            );
          }
        }
      });
  }

  discoveryProcessors(): void {
    this.discoveryService
      .getProviders()
      .forEach((wrapper: InstanceWrapper<JobProcessor>) => {
        const { host, instance } = wrapper;

        if (
          typeof host !== "undefined" &&
          typeof instance?.constructor !== "undefined"
        ) {
          const metadata = this.reflector.get(
            ProcessorDecorator,
            instance?.constructor,
          );

          if (typeof metadata !== "undefined") {
            const queue = this.queueMap.get(metadata.queue);

            if (typeof queue === "undefined") {
              throw new Error(
                `Queue ${metadata.queue} not found for processor ${instance?.constructor.name}`,
              );
            }

            const isRequestScoped = !wrapper.isDependencyTreeStatic();

            const processors =
              this.processorMap.get(metadata.queue) ??
              new Map<string, ProcessorFunction>();

            processors.set(
              metadata.name,
              this.wrapRequestContext(
                wrapTimeout(
                  isRequestScoped
                    ? async (job) => {
                        const contextId = createContextId();

                        this.moduleRef.registerRequestByContextId(
                          job,
                          contextId,
                        );

                        const contextInstance =
                          await this.injector.loadPerContext(
                            instance,
                            host,
                            host.providers,
                            contextId,
                          );

                        return await contextInstance.process(job);
                      }
                    : instance.process.bind(instance),
                ),
              ),
            );

            this.processorMap.set(metadata.queue, processors);
          }
        }
      });
  }

  createWorkers(): void {
    [...this.queueMap.entries()].forEach(([name, queue]) => {
      const consumer = this.consumerMap.get(name);
      const processors = this.processorMap.get(name);

      if (
        typeof consumer !== "undefined" ||
        typeof processors !== "undefined"
      ) {
        this.workerMap.set(
          name,
          new Worker(
            name,
            async (job) => {
              const processor = processors?.get(job.name);

              if (typeof processor !== "undefined") {
                return await processor(job);
              } else if (typeof consumer !== "undefined") {
                return await consumer(job);
              } else {
                throw new Error(
                  `Processor ${job.name} not found for queue ${name}`,
                );
              }
            },
            {
              autorun: false,
              metrics: {
                maxDataPoints: MetricsTime.TWO_WEEKS,
              },
              ...queue.opts,
            },
          ),
        );

        this.logger.log(`Worker ${name} created`);
      }
    });
  }

  wrapRequestContext(processor: ProcessorFunction) {
    return async (job: Job) => {
      const ctx = new RequestContext();
      ctx.set("job", job);
      return await RequestContext.run(ctx, () => processor(job));
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit(): Promise<void> {
    this.discoveryQueues();
    this.discoveryConsumers();
    this.discoveryProcessors();
    this.createWorkers();

    [...this.queueMap.entries()].forEach(([, queue]) => {
      queue.on(
        "waiting",
        (job) => void this.jobEntityService.upsert(job, JobStatus.PENDING),
      );
    });

    [...this.workerMap.entries()].forEach(([, worker]) => {
      worker.on(
        "active",
        (job) => void this.jobEntityService.upsert(job, JobStatus.RUNNING),
      );
      worker.on(
        "progress",
        (job) => void this.jobEntityService.upsert(job, JobStatus.RUNNING),
      );
      worker.on(
        "completed",
        (job) => void this.jobEntityService.upsert(job, JobStatus.COMPLETED),
      );
      worker.on(
        "failed",
        (job) =>
          job && void this.jobEntityService.upsert(job, JobStatus.FAILED),
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(
      [...this.queueMap.entries()].map(async ([name, queue]) => {
        if ((await queue.client).status === "ready") {
          await queue.close();
        }

        this.logger.log(`Queue ${name} closed`);
      }),
    );

    await Promise.all(
      [...this.workerMap.entries()].map(async ([name, worker]) => {
        if ((await worker.client).status === "ready") {
          await worker.close();
        }

        this.logger.log(`Worker ${name} closed`);
      }),
    );
  }
}
