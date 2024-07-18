import { Consumer, InjectQueue, Job, Queue } from "@nest-boot/queue";
import { Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import ms from "ms";

import {
  SCHEDULE_METADATA_KEY,
  SCHEDULE_QUEUE_NAME,
} from "./schedule.module-definition";
import { type ScheduleOptions } from "./schedule-options.interface";

@Consumer(SCHEDULE_QUEUE_NAME)
export class ScheduleService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScheduleService.name);

  private readonly schedules = new Map<
    string,
    {
      handler: () => Promise<void>;
      options: ScheduleOptions;
    }
  >();

  constructor(
    @InjectQueue(SCHEDULE_QUEUE_NAME)
    private readonly queue: Queue,
    private readonly reflector: Reflector,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  async consume(job: Job) {
    const schedule = this.schedules.get(job.name);

    if (typeof schedule !== "undefined") {
      await schedule.handler();
    }
  }

  private discoverySchedules() {
    [
      ...this.discoveryService.getControllers(),
      ...this.discoveryService.getProviders(),
    ].forEach((wrapper) => {
      if (typeof wrapper.instance === "object" && wrapper.instance !== null) {
        const { instance } = wrapper;

        this.metadataScanner
          .getAllMethodNames(Object.getPrototypeOf(instance))
          .forEach((key) => {
            const instanceClassName = instance.constructor.name;

            if (typeof instanceClassName === "string") {
              const options: ScheduleOptions = this.reflector.get(
                SCHEDULE_METADATA_KEY,
                instance[key],
              );

              if (typeof options !== "undefined") {
                this.schedules.set(`${instanceClassName}.${key}`, {
                  handler: instance[key].bind(instance),
                  options,
                });
              }
            }
          });
      }
    });
  }

  private async cleanUnregisteredSchedules(): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();

    await Promise.all(
      repeatableJobs
        .filter(
          (repeatableJob) =>
            this.schedules
              .get(repeatableJob.name)
              ?.options?.value.toString() !== repeatableJob.pattern,
        )
        .map(async (repeatableJob) => {
          await this.queue.removeRepeatableByKey(repeatableJob.key);

          this.logger.log(
            `Removed {${repeatableJob.name}, ${String(repeatableJob.pattern ?? "null")}}`,
          );
        }),
    );
  }

  private async registerSchedules(): Promise<void> {
    await Promise.all(
      [...this.schedules.entries()].map(
        async ([
          name,
          {
            options: { type, value, timezone },
          },
        ]) => {
          await this.queue.add(
            name,
            {},
            {
              repeat:
                type === "cron"
                  ? { pattern: value.toString(), tz: timezone }
                  : {
                      every: typeof value === "string" ? ms(value) : value,
                    },
              removeOnFail: true,
              removeOnComplete: true,
            },
          );

          this.logger.log(`Registered {${name}, ${type}, ${String(value)}}`);
        },
      ),
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    this.discoverySchedules();
    await this.cleanUnregisteredSchedules();
    await this.registerSchedules();
  }
}
