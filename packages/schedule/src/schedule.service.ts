import { RequestContext } from "@nest-boot/request-context";
import {
  Inject,
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
import { Job, MetricsTime, Queue, Worker } from "bullmq";
import ms from "ms";

import {
  MODULE_OPTIONS_TOKEN,
  SCHEDULE_METADATA_KEY,
} from "./schedule.module-definition";
import { ScheduleMetadataOptions } from "./schedule-metadata-options.interface";
import { ScheduleModuleOptions } from "./schedule-module-options.interface";

@Injectable()
export class ScheduleService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ScheduleService.name);
  private readonly injector = new Injector();

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
    private readonly metadataScanner: MetadataScanner
  ) {
    this.name = options.name ?? "nest-boot-schedule";
    this.queue = new Queue(this.name, options);
  }

  async discoverySchedules(): Promise<void> {
    this.discoveryService.getControllers().forEach((wrapper) => {
      const { host, scope, instance } = wrapper;

      this.metadataScanner.scanFromPrototype(
        instance,
        Object.getPrototypeOf(instance),
        (key: string) => {
          if (
            typeof host !== "undefined" &&
            typeof instance.constructor.name === "string"
          ) {
            const scheduleMetadataOptions: ScheduleMetadataOptions =
              this.reflector.get(SCHEDULE_METADATA_KEY, instance[key]);

            if (typeof scheduleMetadataOptions !== "undefined") {
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              this.schedules.set(`${instance.constructor.name}#${key}`, {
                ...scheduleMetadataOptions,
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
            `Removed {${repeatableJob.name}, ${repeatableJob.pattern}}`
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

        this.logger.log(`Registered {${name}, ${value}}`);
      })
    );
  }

  async processor(job: Job): Promise<void> {
    const ctx = new RequestContext(this.moduleRef);
    ctx.set("job", job);

    const processor = this.schedules.get(job.name)?.processor;

    if (typeof processor === "function") {
      await RequestContext.run(ctx, processor);
    }
  }

  async start(): Promise<void> {
    if (this.worker instanceof Worker && !this.worker.isRunning()) {
      void this.worker.run();
      this.logger.log(`Worker started`);
    }
  }

  async onModuleInit(): Promise<void> {
    await this.discoverySchedules();

    await this.cleanUnregisteredSchedules();

    await this.registerSchedules();

    this.worker = new Worker(this.name, this.processor.bind(this), {
      autorun: false,
      metrics: {
        maxDataPoints: MetricsTime.ONE_MONTH,
      },
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
