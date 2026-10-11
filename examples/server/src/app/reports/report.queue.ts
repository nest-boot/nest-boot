import { BaseQueue, Queue } from '@nest-boot/queue';

/** Values to summarize, with optional ownership supplied by trusted application code. */
export interface ReportData {
  values: number[];
  userId?: string;
  workspaceId?: string;
}

/** Small report stored as the BullMQ job's return value. */
export interface ReportResult {
  count: number;
  total: number;
  average: number | null;
}

/** Injectable queue named report-queue; no constructor or injection token is needed. */
@Queue({
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 24 * 60 * 60, count: 100 },
    removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
  },
})
export class ReportQueue extends BaseQueue<
  ReportData,
  ReportResult,
  'summarize'
> {}
