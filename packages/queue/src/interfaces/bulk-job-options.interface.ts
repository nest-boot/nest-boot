import { type BulkJobOptions as BaseBulkJobOptions } from "bullmq";

export interface BulkJobOptions extends BaseBulkJobOptions {
  timeout?: number;
}
