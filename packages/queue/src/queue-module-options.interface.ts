import { ConnectionOptions, type QueueOptions } from "bullmq";

/** Configuration options for the BullMQ module. */
export interface QueueModuleOptions extends Omit<QueueOptions, "connection"> {
  /** Redis connection options for BullMQ queues and workers. */
  connection?: ConnectionOptions;
}
