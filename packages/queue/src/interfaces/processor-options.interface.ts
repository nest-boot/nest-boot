import type { WorkerOptions } from "bullmq";

/** Worker settings; Redis connection and namespace come from its queue. */
export type ProcessorOptions = Omit<
  WorkerOptions,
  "connection" | "prefix" | "telemetry" | "autorun"
>;
