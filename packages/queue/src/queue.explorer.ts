import { RequestContext } from "@nest-boot/request-context";
import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import {
  DiscoveryService,
  MetadataScanner,
  ModuleRef,
  Reflector,
} from "@nestjs/core";
import { Job, Queue, Worker } from "bullmq";

import { ProcessorMetadataOptions } from "./interfaces/processor-metadata-options.interface";
import { PROCESSOR_METADATA_KEY } from "./queue.module-definition";

@Injectable()
export class QueueExplorer implements OnModuleInit, OnApplicationShutdown {
  readonly processors: Map<
    string,
    ProcessorMetadataOptions & { processor: () => Promise<void> }
  > = new Map();

  readonly queues: Map<string, Queue> = new Map();

  readonly workers: Map<string, Worker> = new Map();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly reflector: Reflector,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly logger: Logger
  ) {}

  discoveryJobs(): void {
    [
      ...this.discoveryService.getControllers(),
      ...this.discoveryService.getProviders(),
    ].forEach((wrapper) => {
      const { instance } = wrapper;

      if (typeof instance === "object" && instance !== null) {
        this.metadataScanner.scanFromPrototype(
          instance,
          Object.getPrototypeOf(instance),
          (key: string) => {
            if (typeof instance.constructor.name === "string") {
              const metadataOptions =
                this.reflector.get<ProcessorMetadataOptions>(
                  PROCESSOR_METADATA_KEY,
                  instance[key]
                );

              if (typeof metadataOptions !== "undefined") {
                this.processors.set(metadataOptions.name, {
                  ...metadataOptions,
                  processor: instance[key].bind(instance),
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

  async processor(job: Job): Promise<void> {
    const ctx = new RequestContext();
    ctx.set("job", job);

    const processor = this.processors.get(job.name)?.processor;

    if (typeof processor === "function") {
      await RequestContext.run(ctx, processor);
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
