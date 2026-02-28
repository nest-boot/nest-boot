import { type RegisterQueueOptions } from "@nest-boot/bullmq";
import { type ConnectionOptions } from "bullmq";

/**
 * Configuration options for the schedule module.
 *
 * @remarks
 * Extends BullMQ queue options with schedule-specific settings
 * for controlling job processing behavior.
 */
export interface ScheduleModuleOptions extends RegisterQueueOptions {
  /** Whether to automatically start processing scheduled jobs on module init. */
  autorun?: boolean;
  /** Maximum number of concurrent scheduled jobs to process. */
  concurrency?: number;
  /** Optional Redis connection options for the schedule queue. */
  connection?: ConnectionOptions;
}
