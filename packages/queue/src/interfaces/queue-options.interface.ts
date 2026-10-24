import type { QueueOptions as BullmqQueueOptions } from "bullmq";

/** Redis queue settings; the connection defaults to REDIS_URL. */
export type QueueOptions = Omit<BullmqQueueOptions, "connection"> & {
  connection?: BullmqQueueOptions["connection"];
};
