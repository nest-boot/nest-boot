import { BaseProcessor, type Job, Processor } from '@nest-boot/queue';
import { RequestContext } from '@nest-boot/request-context';
import { Logger } from '@nestjs/common';

import { ReportQueue } from './report.queue.js';

/** Reads each job's context through the static RequestContext API. */
@Processor(ReportQueue)
export class ReportProcessor extends BaseProcessor {
  constructor() {
    super({ concurrency: 2 });
  }
  private readonly logger = new Logger(ReportProcessor.name);

  /**
   * Generates an example statistical report without external side effects.
   * @param job - Persisted report input.
   * @returns The summary, stored by BullMQ for server-side use.
   */
  async processSummarize(job: Job<ReportQueue, 'summarize'>) {
    const context = RequestContext.current();
    const { values } = job.data;
    const total = values.reduce((sum, value) => sum + value, 0);
    const result = {
      count: values.length,
      total,
      average: values.length ? total / values.length : null,
    };
    await job.updateProgress(100);
    this.logger.log(
      `Generated report ${job.id} in ${context.type} context ${context.id}`,
    );
    return result;
  }
}
