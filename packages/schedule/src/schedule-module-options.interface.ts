import { type RegisterQueueOptions } from "@nest-boot/bullmq";

/**
 * Options for configuring the ScheduleModule.
 */
export interface ScheduleModuleOptions extends RegisterQueueOptions {
  /**
   * Whether to automatically run the scheduler worker.
   * Default: true
   */
  autorun?: boolean;

  /**
   * Concurrency for the scheduler worker.
   */
  concurrency?: number;
}
