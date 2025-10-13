import { ConnectionOptions, type QueueOptions } from "bullmq";

export interface BullModuleOptions extends Omit<QueueOptions, "connection"> {
  connection?: ConnectionOptions;
}
