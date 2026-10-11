import { QueueModule } from '@nest-boot/queue';
import { ScheduleModule } from '@nest-boot/schedule';
import { Module } from '@nestjs/common';

import { getJobReadFilter } from './job-access.js';

/** Persist queue jobs and expose queries when the application's database and GraphQL services exist. */
@Module({
  imports: [
    QueueModule.forRootAsync({
      useFactory: () => ({
        prefix: process.env.BULLMQ_PREFIX ?? 'nest-boot-example',
        getJobReadFilter,
      }),
    }),
    ScheduleModule,
  ],
})
export class JobsModule {}
