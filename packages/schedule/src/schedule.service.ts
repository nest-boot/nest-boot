import { InjectQueue, Queue } from "@nest-boot/queue";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import ms from "ms";

import { getScheduleProcessorName } from "./get-schedule-processor-name.util";
import { SCHEDULE_METADATA_KEY } from "./schedule.module-definition";
import { type ScheduleMetadataOptions } from "./schedule-metadata-options.interface";

@Injectable()
export class ScheduleService implements OnModuleInit {
  private readonly logger = new Logger(ScheduleService.name);

  private readonly schedules = new Map<string, ScheduleMetadataOptions>();

  constructor(
    @InjectQueue("schedule")
    private readonly queue: Queue,
    private readonly reflector: Reflector,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  discoverySchedules() {
    this.discoveryService.getProviders().forEach((wrapper) => {
      if (typeof wrapper.instance === "object" && wrapper.instance !== null) {
        const { instance } = wrapper;

        this.metadataScanner
          .getAllMethodNames(Object.getPrototypeOf(instance))
          .forEach((key) => {
            if (typeof instance.constructor.name === "string") {
              const scheduleMetadataOptions: ScheduleMetadataOptions =
                this.reflector.get(SCHEDULE_METADATA_KEY, instance[key]);

              if (typeof scheduleMetadataOptions !== "undefined") {
                this.schedules.set(
                  getScheduleProcessorName(instance, key),
                  scheduleMetadataOptions,
                );
              }
            }
          });
      }
    });
  }

  async cleanUnregisteredSchedules(): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();

    await Promise.all(
      repeatableJobs
        .filter(
          (repeatableJob) =>
            this.schedules.get(repeatableJob.name)?.value.toString() !==
            repeatableJob.pattern,
        )
        .map(async (repeatableJob) => {
          await this.queue.removeRepeatableByKey(repeatableJob.key);

          this.logger.log(
            `Removed {${repeatableJob.name}, ${repeatableJob.pattern}}`,
          );
        }),
    );
  }

  async registerSchedules(): Promise<void> {
    await Promise.all(
      [...this.schedules.entries()].map(
        async ([name, { type, value, timezone }]) => {
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

          this.logger.log(`Registered {${name}, ${value}}`);
        },
      ),
    );
  }

  async onModuleInit(): Promise<void> {
    this.discoverySchedules();

    await this.cleanUnregisteredSchedules();

    await this.registerSchedules();
  }
}
