import { RequestContext } from "@nest-boot/request-context";
import {
  Inject,
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
import ms from "ms";

import {
  MODULE_OPTIONS_TOKEN,
  SCHEDULE_METADATA_KEY,
} from "./schedule.module-definition";
import { ScheduleMetadataOptions } from "./schedule-metadata-options.interface";
import { ScheduleModuleOptions } from "./schedule-module-options.interface";

@Injectable()
export class ScheduleService implements OnModuleInit, OnApplicationShutdown {
  private readonly name: string;

  private readonly queue: Queue;
  private worker?: Worker;

  private readonly schedules: Map<
    string,
    ScheduleMetadataOptions & { processor: () => Promise<void> }
  > = new Map();

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: ScheduleModuleOptions,
    private readonly moduleRef: ModuleRef,
    private readonly reflector: Reflector,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly logger: Logger
  ) {
    this.name = options.name ?? "nest-boot-schedule";
    this.queue = new Queue(this.name, options);
  }

  async discoverySchedules(): Promise<void> {
    this.discoveryService.getControllers().forEach((wrapper) => {
      const { instance } = wrapper;

      this.metadataScanner.scanFromPrototype(
        instance,
        Object.getPrototypeOf(instance),
        (key: string) => {
          if (typeof instance.constructor.name === "string") {
            const scheduleMetadataOptions: ScheduleMetadataOptions =
              this.reflector.get(SCHEDULE_METADATA_KEY, instance[key]);

            if (typeof scheduleMetadataOptions !== "undefined") {
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              this.schedules.set(`${instance.constructor.name}#${key}`, {
                ...scheduleMetadataOptions,
                processor: () => instance[key](),
              });
            }
          }
        }
      );
    });
  }

  async cleanUnregisteredSchedules(): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();

    await Promise.all(
      repeatableJobs
        .filter(
          (repeatableJob) =>
            this.schedules.get(repeatableJob.name)?.value.toString() !==
            repeatableJob.pattern
        )
        .map(async (repeatableJob) => {
          await this.queue.removeRepeatableByKey(repeatableJob.key);

          this.logger.log(
            `Removed {${repeatableJob.name}, ${repeatableJob.pattern}}`,
            this.constructor.name
          );
        })
    );
  }

  async registerSchedules(): Promise<void> {
    await Promise.all(
      [...this.schedules.entries()].map(async ([name, { type, value }]) => {
        await this.queue.add(
          name,
          {},
          {
            repeat:
              type === "cron"
                ? { pattern: value.toString() }
                : {
                    every: typeof value === "string" ? ms(value) : value,
                  },
            removeOnFail: true,
            removeOnComplete: true,
          }
        );

        this.logger.log(
          `Registered {${name}, ${value}}`,
          this.constructor.name
        );
      })
    );
  }

  async processor(job: Job): Promise<void> {
    const ctx = new RequestContext();
    ctx.set("job", job);

    const processor = this.schedules.get(job.name)?.processor;

    if (typeof processor === "function") {
      await RequestContext.run(ctx, processor);
    }
  }

  async start(): Promise<void> {
    if (this.worker instanceof Worker && !this.worker.isRunning()) {
      void this.worker.run();
      this.logger.log(`Worker started`, this.constructor.name);
    }
  }

  async onModuleInit(): Promise<void> {
    await this.discoverySchedules();

    await this.cleanUnregisteredSchedules();

    await this.registerSchedules();

    this.worker = new Worker(this.name, this.processor.bind(this), {
      autorun: false,
      ...this.options,
    });

    this.worker.on("failed", (job, err) => {
      this.logger.error(
        err,
        typeof job !== "undefined"
          ? { queueName: job.queueName, jobName: job.name, jobId: job.id }
          : {}
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
    await this.worker?.close();
  }
}
