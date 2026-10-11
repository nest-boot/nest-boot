import { Module } from '@nestjs/common';

import { ReportProcessor } from './report.processor.js';
import { ReportQueue } from './report.queue.js';
import { ReportSchedule } from './report.schedule.js';

/** Reuses the global Queue and Schedule services configured by JobsModule. */
@Module({
  providers: [ReportQueue, ReportProcessor, ReportSchedule],
  exports: [ReportQueue],
})
export class ReportsModule {}
