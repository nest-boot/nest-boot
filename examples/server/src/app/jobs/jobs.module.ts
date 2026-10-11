import { QueueModule } from '@nest-boot/queue';
import { ScheduleModule } from '@nest-boot/schedule';
import { Module } from '@nestjs/common';

import { getJobReadFilter } from './job-access.js';

/** Configure global queues, scheduling and authorized native job queries once. */
@Module({
  imports: [
    QueueModule.forRoot({ getJobReadFilter }),
    ScheduleModule.forRoot({ concurrency: 2 }),
  ],
})
export class JobsModule {}
