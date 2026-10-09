# @nest-boot/queue

`QueueModule` configures BullMQ queues and workers for Nest Boot. When the application
also imports `HealthCheckModule`, it automatically registers a health indicator
for each discovered `Queue` provider, including custom subclasses:

```ts
import { QueueModule } from "@nest-boot/queue";
import { HealthCheckModule } from "@nest-boot/health-check";
import { Module } from "@nestjs/common";

@Module({
  imports: [
    HealthCheckModule,
    QueueModule,
    QueueModule.registerQueue({ name: "email" }),
  ],
})
export class AppModule {}
```

Queues are discovered after application modules initialize. Provider aliases of
the same instance produce one check. Keys use `queue.<name>`, for example
`queue.email` and `queue.upload`, matching the application's registered queue names.

Each check uses the existing queue connection, requires it to be ready, and reads
the queue's pause state. Readiness and reading together are limited to 1000 ms.
Closing queues, unavailable connections, read failures, and timeouts report
`down`; later checks can recover. A paused queue reports `up` with `paused: true`.
The probe checks queue access, not worker availability, processing throughput,
backlog, or historical failed jobs. It does not create jobs or change queue state.
Repeated probes share any still-pending read for the same queue, including after
a timeout; separate queues continue to be checked independently.

Without `HealthCheckModule`, no queues are discovered for health checks and no
checks run. The module does not import it or add a health endpoint. The exported
`QueueHealthIndicator` also supports explicit `check(key, queue, timeout)` calls.
