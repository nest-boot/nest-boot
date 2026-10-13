import { Cron, Interval } from '@nest-boot/schedule';
import { Injectable } from '@nestjs/common';

import { ReportQueue } from './report.queue.js';

/** Scheduled handlers enqueue work; ReportProcessor owns processing and retries. */
@Injectable()
export class ReportSchedule {
  constructor(private readonly reports: ReportQueue) {}

  /** Enqueues a daily report at midnight UTC using illustrative sample values. */
  @Cron('0 0 * * *', {
    timezone: 'UTC',
    removeOnComplete: true,
    removeOnFail: 100,
  })
  async daily(): Promise<void> {
    await this.reports.add('summarize', { values: [10, 20, 30] });
  }

  /** Enqueues a small sample report every five minutes. */
  @Interval(5 * 60 * 1000, { removeOnComplete: true, removeOnFail: 100 })
  async sample(): Promise<void> {
    await this.reports.add('summarize', { values: [2, 4, 6] });
  }
}
