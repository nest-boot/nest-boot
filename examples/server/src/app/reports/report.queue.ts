import { BaseQueue, Queue } from '@nest-boot/queue';
import { QueueVisible } from '@nest-boot/queue-api';
import { z } from 'zod';

/** Injectable queue named report-queue; configured with constructor options. */
@QueueVisible()
@Queue('report-queue')
export class ReportQueue extends BaseQueue {
  readonly jobSchemas = {
    summarize: {
      data: z.object({
        values: z.array(z.number()),
        userId: z.string().optional(),
        workspaceId: z.string().optional(),
      }),
      result: z.object({
        count: z.number(),
        total: z.number(),
        average: z.number().nullable(),
      }),
    },
  };

  constructor() {
    super({
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 100 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
      },
    });
  }
}

export type ReportData = z.input<
  ReportQueue['jobSchemas']['summarize']['data']
>;
export type ReportResult = z.output<
  ReportQueue['jobSchemas']['summarize']['result']
>;
