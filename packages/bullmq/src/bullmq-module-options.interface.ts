import { ConnectionOptions, type QueueOptions } from "bullmq";

/**
 * Options for configuring the BullModule.
 */
export interface BullModuleOptions extends Omit<QueueOptions, "connection"> {
  /**
   * Connection options for Redis.
   */
  connection?: ConnectionOptions;
}
