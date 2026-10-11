import { BaseProcessor, Processor } from '@nest-boot/queue';
import { RequestContext } from '@nest-boot/request-context';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  type ReportData,
  ReportQueue,
  type ReportResult,
} from './report.queue.js';

/** RequestContext injection gives each job its own processor instance and context. */
@Processor(ReportQueue, { concurrency: 2 })
export class ReportProcessor extends BaseProcessor {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(private readonly context: RequestContext) {
    super();
  }

  /**
   * Generates an example statistical report without external side effects.
   * @param job - Persisted report input.
   * @returns The summary, stored by BullMQ for server-side use.
   */
  async process(
    job: Job<ReportData, ReportResult, 'summarize'>,
  ): Promise<ReportResult> {
    const { values } = job.data;
    const total = values.reduce((sum, value) => sum + value, 0);
    const result = {
      count: values.length,
      total,
      average: values.length ? total / values.length : null,
    };
    await job.updateProgress(100);
    this.logger.log(
      `Generated report ${job.id} in ${this.context.type} context ${this.context.id}`,
    );
    return result;
  }
}
