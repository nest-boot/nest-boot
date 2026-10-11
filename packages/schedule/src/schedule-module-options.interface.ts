import { type QueueOptions } from "@nest-boot/queue";

/**
 * Configuration options for the schedule module.
 *
 * Extends BullMQ queue options with schedule-specific settings
 * for controlling job processing behavior.
 */
export interface ScheduleModuleOptions extends QueueOptions {
  /** Whether to automatically start processing scheduled jobs on module init. */
  autorun?: boolean;
  /** Maximum number of concurrent scheduled jobs to process. */
  concurrency?: number;
}
