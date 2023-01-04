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

  private readonly schedules: Array<{
    name: string;
    type: "cron" | "interval";
    value: number | string;
    handler: () => Promise<void>;
  }> = [];

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
              this.schedules.push({
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                name: `${instance.constructor.name}#${key}`,
                type: scheduleMetadataOptions.type,
                value: scheduleMetadataOptions.value,
                handler: () => instance[key](),
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
            typeof this.schedules.find(
              (schedule) =>
                schedule.name === repeatableJob.name &&
                schedule.value.toString() === repeatableJob.pattern
            ) === "undefined"
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
      this.schedules.map(async (schedule) => {
        await this.queue.add(
          schedule.name,
          {},
          {
            repeat:
              schedule.type === "cron"
                ? { pattern: schedule.value.toString() }
                : {
                    every:
                      typeof schedule.value === "string"
                        ? ms(schedule.value)
                        : schedule.value,
                  },
            removeOnFail: true,
            removeOnComplete: true,
          }
        );

        this.logger.log(
          `Registered {${schedule.name}, ${schedule.value}}`,
          this.constructor.name
        );
      })
    );
  }

  async processor(job: Job): Promise<void> {
    const ctx = new RequestContext();
    ctx.set("job", job);
    // ctx.set("entityManager", this.moduleRef.get(EntityManager).fork());

    await RequestContext.run(ctx, async () => {
      const schedule = this.schedules.find(
        (schedule) => schedule.name === job.name
      );

      if (typeof schedule !== "undefined") {
        await schedule.handler();
      }
    });
  }

  async onModuleInit(): Promise<void> {
    await this.discoverySchedules();

    await this.cleanUnregisteredSchedules();

    await this.registerSchedules();

    this.worker = new Worker(
      this.name,
      async (job: Job) => {
        await this.processor(job);
      },
      this.options
    );

    this.worker.on("failed", (job, err) => {
      this.logger.error(err);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}
