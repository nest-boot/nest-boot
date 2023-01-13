import { RequestContext } from "@nest-boot/request-context";
import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
  Scope,
} from "@nestjs/common";
import {
  createContextId,
  DiscoveryService,
  MetadataScanner,
  ModuleRef,
  Reflector,
} from "@nestjs/core";
import { Injector } from "@nestjs/core/injector/injector";
import { Processor, Queue, Worker } from "bullmq";

import { ProcessorMetadataOptions } from "./interfaces/processor-metadata-options.interface";
import { PROCESSOR_METADATA_KEY } from "./queue.module-definition";

@Injectable()
export class QueueExplorer implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QueueExplorer.name);
  private readonly injector = new Injector();

  readonly processors: Map<
    string,
    ProcessorMetadataOptions & { processor: Processor }
  > = new Map();

  readonly queues: Map<string, Queue> = new Map();

  readonly workers: Map<string, Worker> = new Map();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly reflector: Reflector,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner
  ) {}

  discoveryJobs(): void {
    [
      ...this.discoveryService.getControllers(),
      ...this.discoveryService.getProviders(),
    ].forEach((wrapper) => {
      const { host, scope, instance } = wrapper;

      if (typeof instance === "object" && instance !== null) {
        this.metadataScanner.scanFromPrototype(
          instance,
          Object.getPrototypeOf(instance),
          (key: string) => {
            if (
              typeof host !== "undefined" &&
              typeof instance.constructor.name === "string"
            ) {
              const metadataOptions =
                this.reflector.get<ProcessorMetadataOptions>(
                  PROCESSOR_METADATA_KEY,
                  instance[key]
                );

              if (typeof metadataOptions !== "undefined") {
                this.processors.set(metadataOptions.name, {
                  ...metadataOptions,
                  processor:
                    scope === Scope.REQUEST
                      ? async (...args) => {
                          const contextId = createContextId();

                          const contextInstance =
                            await this.injector.loadPerContext(
                              instance,
                              host,
                              host.providers,
                              contextId
                            );

                          return contextInstance[key](...args);
                        }
                      : instance[key].bind(instance),
                });

                this.logger.log(`Processor ${metadataOptions.name} discovered`);
              }
            }
          }
        );
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

  async processor(...args: Parameters<Processor>): Promise<void> {
    const [job] = args;

    const ctx = new RequestContext();
    ctx.set("job", job);

    const processor = this.processors.get(job.name)?.processor;

    if (typeof processor === "function") {
      await RequestContext.run(ctx, async () => {
        await processor(...args);
      });
    }
  }

  async onModuleInit(): Promise<void> {
    this.discoveryJobs();
    this.discoveryQueues();

    [...this.queues.entries()].forEach(([name, queue]) => {
      const worker = new Worker(name, this.processor.bind(this), {
        autorun: false,
        ...queue.opts,
      });

      worker.on("failed", (job, err) => {
        this.logger.error(err);
      });

      this.workers.set(name, worker);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(
      [...this.queues.entries()].map(async ([name, queue]) => {
        await queue.close();

        this.logger.log(`Queue ${name} closed`);
      })
    );

    await Promise.all(
      [...this.workers.entries()].map(async ([name, worker]) => {
        await worker.close();

        this.logger.log(`Worker ${name} closed`);
      })
    );
  }
}
