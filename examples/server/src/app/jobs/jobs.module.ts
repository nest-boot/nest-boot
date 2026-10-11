import { QueueModule } from '@nest-boot/queue';
import { ScheduleModule } from '@nest-boot/schedule';
import { Module } from '@nestjs/common';

import { getJobReadFilter } from './job-access.js';

/** Expose native PostgreSQL job queries when the application's database and GraphQL services exist. */
@Module({
  imports: [
    QueueModule.forRootAsync({
      useFactory: () => ({
        getJobReadFilter,
      }),
    }),
    ScheduleModule,
  ],
})
export class JobsModule {}
