import { InjectQueue } from "@nest-boot/bullmq";
import { Logger, OnApplicationBootstrap } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { Queue } from "bullmq";

import {
  SCHEDULE_METADATA_KEY,
  SCHEDULE_QUEUE_NAME,
} from "./schedule.module-definition";
import { type ScheduleOptions } from "./schedule-options.interface";

/**
 * Registry for scheduled jobs.
 * Scans for @Schedule decorators and registers them as BullMQ jobs.
 */
export class ScheduleRegistry implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScheduleRegistry.name);

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

  /**
   * Retrieves a scheduled task by name.
   *
   * @param name - The name of the scheduled task.
   * @returns The handler and options for the task.
   */
  get(name: string) {
    return this.schedules.get(name);
  }

  /**
   * Discovers methods decorated with @Schedule across the application.
   */
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

  /**
   * Removes scheduled jobs from BullMQ that are no longer registered in the code.
   */
  private async cleanUnregisteredSchedules(): Promise<void> {
    const jobSchedulers = await this.queue.getJobSchedulers();

    for (const jobScheduler of jobSchedulers) {
      if (!this.schedules.get(jobScheduler.name)) {
        await this.queue.removeJobScheduler(jobScheduler.name);

        this.logger.log(
          `Removed {${jobScheduler.name}, ${jobScheduler.pattern ? "cron" : "interval"}, ${String(jobScheduler.pattern ?? jobScheduler.every)}}`,
        );
      }
    }
  }

  /**
   * Registers discovered schedules as BullMQ jobs.
   */
  private async registerSchedules(): Promise<void> {
    for (const [
      name,
      {
        options: { type, value, timezone, ...jobOptions },
      },
    ] of this.schedules.entries()) {
      await this.queue.upsertJobScheduler(
        name,
        {
          tz: timezone ?? "UTC",
          ...(type === "cron"
            ? {
                pattern: value.toString(),
              }
            : {
                every: Number(value),
              }),
        },
        {
          name,
          opts: jobOptions,
        },
      );

      this.logger.log(`Registered {${name}, ${type}, ${String(value)}}`);
    }
  }

  /**
   * Bootstrap hook to initialize schedules.
   */
  async onApplicationBootstrap(): Promise<void> {
    this.discoverySchedules();
    await this.cleanUnregisteredSchedules();
    await this.registerSchedules();
  }
}
