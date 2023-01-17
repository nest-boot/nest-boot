import { JobsOptions as BaseJobOptions } from "bullmq";

export interface JobOptions extends BaseJobOptions {
  timeout: number;
}
