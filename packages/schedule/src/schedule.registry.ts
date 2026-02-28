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
 * Registry that discovers and manages scheduled jobs at application startup.
 *
 * @remarks
 * Scans all controllers and providers for methods decorated with
 * {@link Schedule}, {@link Cron}, or {@link Interval}, then registers
 * them as BullMQ job schedulers. Removes stale schedulers that are no
 * longer defined in the codebase.
 */
export class ScheduleRegistry implements OnApplicationBootstrap {
  /** Logger instance for the schedule registry. @internal */
  private readonly logger = new Logger(ScheduleRegistry.name);

  /** Map of schedule names to their handlers and options. @internal */
  private readonly schedules = new Map<
    string,
    {
      /** Handler function bound to the original instance. */
      handler: () => Promise<void>;
      /** Schedule options from the decorator. */
      options: ScheduleOptions;
    }
  >();

  /**
   * Creates a new ScheduleRegistry instance.
   * @param queue - BullMQ queue for managing scheduled jobs
   * @param reflector - NestJS reflector for reading decorator metadata
   * @param discoveryService - NestJS discovery service for scanning providers
   * @param metadataScanner - Scanner for extracting method metadata
   */
  constructor(
    @InjectQueue(SCHEDULE_QUEUE_NAME)
    private readonly queue: Queue,
    private readonly reflector: Reflector,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  /**
   * Retrieves a registered schedule entry by name.
   * @param name - The schedule identifier (className.methodName)
   * @returns The schedule handler and options, or undefined
   */
  get(name: string) {
    return this.schedules.get(name);
  }

  /** Scans controllers and providers for schedule-decorated methods. @internal */
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

  /** Removes job schedulers that are no longer defined. @internal */
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

  /** Registers all discovered schedules as BullMQ job schedulers. @internal */
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

  /** Discovers all scheduled methods and registers them as BullMQ job schedulers. */
  async onApplicationBootstrap(): Promise<void> {
    this.discoverySchedules();
    await this.cleanUnregisteredSchedules();
    await this.registerSchedules();
  }
}
