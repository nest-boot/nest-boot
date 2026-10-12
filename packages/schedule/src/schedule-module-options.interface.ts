import { type QueueOptions } from "@nest-boot/queue";

/**
 * Configuration options for the schedule module.
 *
 * Extends BullMQ queue options with schedule-specific settings
 * for controlling job processing behavior.
 */
export interface ScheduleModuleOptions extends QueueOptions {
  /** Queue name shared by replicas of one application. Defaults to "schedule". */
  queueName?: string;
  /** Whether to process scheduled jobs when the schedule queue is explicitly started. */
  autorun?: boolean;
  /** Maximum number of concurrent scheduled jobs to process. */
  concurrency?: number;
}
