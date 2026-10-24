# @nest-boot/queue-api

Optional Job history and authenticated GraphQL queries for
[`@nest-boot/queue`](../queue/README.md). Redis remains responsible for queue state
and processing; the database stores asynchronous history snapshots.

## Setup and visibility

Configure the application's global DatabaseModule, GraphQLModule and AuthModule,
then import QueueApiModule. It reuses those configured modules, imports QueueModule
and does not depend on `@nest-boot/schedule`. Register JobEntity in both runtime
and MikroORM CLI entity lists and create its table through application migrations.
The database generates UUID IDs; `(queue, jobId)` identifies the source Redis job.

Register queue providers in the API application and mark each visible queue:

```ts
import { BaseQueue, Queue } from "@nest-boot/queue";
import { QueueApiModule, QueueVisible } from "@nest-boot/queue-api";
import { Module } from "@nestjs/common";

@QueueVisible()
@Queue()
export class EmailQueue extends BaseQueue {}

@Module({
  imports: [QueueApiModule],
  providers: [EmailQueue],
})
export class EmailModule {}
```

`@QueueVisible()` takes no arguments. Each concrete class needs its own marker;
subclasses do not inherit visibility. Unmarked or unregistered queues are excluded
from single-record reads, page nodes and counts, including explicit client
filters. An empty visible set returns no records. Visibility does not change
synchronization, retention or authorization.

## Queries and authorization

Every query uses AuthGuard. JobService reads trusted request identity and applies
the same visibility and ownership constraints to single records, pages and counts:

| Query                            | Access scope                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `userJob` / `userJobs`           | `data.userId` matches the current user                                                    |
| `workspaceJob` / `workspaceJobs` | `data.workspaceId` matches the selected workspace after membership and read authorization |
| `systemJob` / `systemJobs`       | Both owner fields are absent or JSON null, with administrator authorization               |

System reads use AuthModule's configured `user.adminRoles`. API keys do not inherit
their owner's administrator access. Empty strings count as present owner values.
User and workspace scopes can overlap when a task carries both IDs. Missing
identity or unauthorized workspace access is rejected.

JobService exposes `getUserJob`, `getWorkspaceJob`, `getSystemJob` and their
`get*JobConnection` variants. It injects EntityManager directly and exposes no
generic CRUD or unscoped query. Job history has no database RLS; direct ORM access
is a trusted internal operation, so request handlers use the scoped methods.

GraphQL exposes `id`, `queue`, `name`, `status`, finite numeric `progress`,
`createdAt`, `startedAt` and `finishedAt`. Other progress values return null.
Payloads, results, errors, native job IDs and event versions remain private.
Connections support queue, name, status and creation-time filters. CREATED_AT is
the only selectable sort key and defaults to descending; UUID breaks timestamp
ties internally. User/workspace expression indexes and a partial system index
support these scoped cursor reads.

## Synchronization and retention

JobService subscribes to registered queues before their event readers start,
including producer-only instances. It forwards snapshots to the built-in `job`
queue, deduplicating qualified source names and Redis Stream IDs for 24 hours.
The Job worker compares bigint `(lastEventMs, lastEventSeq)` pairs atomically and
only applies newer events. Events from its own queue are excluded to prevent
recursion. Database write failures retry up to 20 times with exponential backoff.

Readers use BullMQ's default starting position without startup replay. Connection
readiness does not guarantee that the first stream read has started. Retain source
jobs long enough to capture full snapshots; when a source job is already removed,
only metadata carried by the event remains available.

Start all registered consumers with `nb queue:start`, or use
`nb queue:start --queue job` for synchronization and cleanup alone. When filtering,
select `job` explicitly in the process intended to persist history. Shutdown drains
source Workers, then event readers and pending submissions, then the Job Worker.

The built-in JobQueue handles `sync` and `cleanup`. One shared BullMQ scheduler on
the `job` queue runs cleanup daily at 00:00 UTC. Cleanup deletes records inactive
for more than 30 days in guarded batches of 1000, regardless of status. Records
without an applied event use `createdAt`. Redis jobs remain intact; later events
recreate deleted records with a new UUID. Cleanup requires the Job Worker.

## Tests

Unit tests sit beside their source files. End-to-end suites live in `test/`:

- `job.resolver`: visibility, ownership, authorization, filters and cursors through HTTP.
- `job-queries`: synchronized Redis history through the GraphQL API.
- `job.processor`: atomic event ordering and retention against PostgreSQL.
- `job.service`: producer-only event forwarding without historical replay.
- `job.entity`: schema, UUID defaults, bigint columns and query indexes.
- `queue-api`: multiple application instances, deduplication, retries and shutdown.

Build before running end-to-end tests because they import the package output:

```bash
pnpm --filter @nest-boot/queue-api build
pnpm --filter @nest-boot/queue-api test
REDIS_URL=redis://localhost:6379 \
QUEUE_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres \
pnpm --filter @nest-boot/queue-api test:e2e
```

Each database suite creates and removes its own database; the PostgreSQL test user
needs permission to create databases and the shared `authenticated` test role.
Redis suites use isolated prefixes and remove their own keys.
