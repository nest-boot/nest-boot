# @nest-boot/queue

`QueueModule` configures BullMQ 6 queues and workers using the official PostgreSQL backend.
Set `QUEUE_DATABASE_URL` or `DATABASE_URL`, and run BullMQ migrations before startup.
Optional MikroORM and GraphQL queries read the native table. Register the exported `entities` array and spread `getJobSchemaOptions()` into both runtime and CLI ORM configuration. The read-only entities map all 11 native BullMQ tables, including defaults, enums, foreign keys and operational indexes. MikroORM uses its standard schema generator to add user/workspace ownership indexes. Run BullMQ migrations first; its functions and independent sequences remain owned by BullMQ. The helper uses native `ignoreRoutines: true`, which applies to all schemas, so existing application functions also require explicit migrations for changes. Keep MikroORM migration snapshots enabled; review live-generated rollback SQL because MikroORM 7.2.0 can restore ignored routines in `down`.
See the [queue tutorial](https://github.com/nest-boot/nest-boot/blob/main/apps/docs/content/docs/tutorial/queue.mdx) for configuration. When the application
also imports `HealthCheckModule`, it automatically registers a health indicator
for each discovered `Queue` provider, including custom subclasses:

```ts
import { BaseQueue, Queue, QueueModule } from "@nest-boot/queue";
import { HealthCheckModule } from "@nest-boot/health-check";
import { Module } from "@nestjs/common";

@Queue()
class EmailQueue extends BaseQueue {}

@Module({
  imports: [HealthCheckModule, QueueModule],
  providers: [EmailQueue],
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

Queues default to `expose: false`. Set `@Queue({ expose: true })` and register the
queue provider in the API application to include its jobs in the optional Job API.
The public fields are `id`, `queue`, `name`, `status`, numeric `progress` and
`createdAt` / `startedAt` / `finishedAt`. Other progress formats return null.
Payloads, raw results, failure details and operational fields stay private;
applications expose business results through their own authorized API.
Database RLS scopes nodes, lists and counts to the verified user or workspace.
Configure the request EntityManager session with the non-owner `authenticated`
role and trusted `app.user.id` / `app.workspace.id` variables, and apply the Job
RLS migration. Empty identities match no rows. BullMQ workers use a separate
owner or `BYPASSRLS` connection.
The flag affects API visibility, not BullMQ storage or direct queue operations.
