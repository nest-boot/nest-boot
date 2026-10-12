# Example server

NestJS API used by the full-stack Nest Boot example. It demonstrates
authentication, permission checks, GraphQL connections, MikroORM,
PostgreSQL row-level security, PostgreSQL-backed BullMQ jobs, middleware, request context,
logging, and application commands.

## Run locally

Start the repository development services, create the local environment file,
and run the server:

```bash
docker compose up -d
cp examples/server/.env.example examples/server/.env
pnpm --filter @nest-boot/example-server queue:migrate
pnpm --filter @nest-boot/example-server migration:up
pnpm --filter @nest-boot/example-server dev
```

The API listens on `http://localhost:4000`; Better Auth is mounted at
`/api/auth` and GraphQL at `/api/graphql`. The configured `AuthModule` provides
all authentication, session, user, workspace, member, invitation and API-key
operations, with cookie sessions and Service authorization preserved.
Entities, connections, enums and resolvers live in `packages/auth/src` and use
concrete class references. Both the runtime ORM configuration and the migration
CLI register `entities` imported from `@nest-boot/auth`. The example configures
abilities and delivery callbacks; it does not redeclare authentication entities.

Workspace invitations are delivered through `workspace.sendInvitationEmail`;
the example sends acceptance links with the globally configured Mailer.

## Commands

`src/cli.ts` calls `CommandFactory.run(AppModule)`, sharing the same application
module as `main.ts` and `repl.ts`. `CommonModule` imports `CommandModule` and
registers `GreetCommand`, which demonstrates inferred positional and boolean options.

After installing dependencies, configuring the services above, and applying database
migrations, run from the repository root:

```bash
pnpm --filter @nest-boot/example-server command --help
pnpm --filter @nest-boot/example-server command greet Alice --loud
```

For a compiled deployment:

```bash
pnpm --filter @nest-boot/example-server build
cd examples/server
node dist/cli.js greet Alice --loud
```

The greeting prints `Hello ALICE!`. Commands run in a RequestContext of type
`command`, and the factory handles exit codes and closes application resources.
Application initialization hooks still run, so the example requires PostgreSQL,
Redis and its database migrations just like the HTTP application.

## Health checks

`CommonModule` imports `HealthCheckModule`, exposing `GET /api/health` through
the framework's middleware manager. `DatabaseModule` automatically registers
the existing ORM connection as `database` using `DatabaseHealthIndicator`.
The indicator initializes MikroORM's lazy
connection during startup. Runtime probes report a closed connection as unhealthy
until the application restores it; the example needs no custom indicator code.
Registered queues also appear as `queue.<name>`, including `queue.schedule`.
The report example adds `queue.report-queue`.
Healthy checks return HTTP 200; a failed or timed-out check returns HTTP 503.
The middleware responds before the global auth guard, so the health endpoint
does not require a login.

## Jobs

`CommonModule` configures `QueueModule` with BullMQ 6's official PostgreSQL backend, configured through
`QUEUE_DATABASE_URL` or `DATABASE_URL`. `ScheduleModule` uses the same backend.
`src/cli.ts` bootstraps the same `AppModule` as `main.ts` and `repl.ts` through `CommandFactory.run()`. Queue workers, event listeners and schedule registration stay inactive in the command context; application providers remain available. Run `pnpm --filter @nest-boot/example-server queue:migrate` first to create or
upgrade BullMQ's schema. Then run application migrations to add ownership indexes,
enable Job RLS and grant the `authenticated` database role schema usage and SELECT on `bullmq.job`.

The built-in `Job` from `@nest-boot/queue` maps that native table through
MikroORM. The CLI configuration composes `withQueueDatabaseConfig(withAuthDatabaseConfig(await getDatabaseConfig()))`.
CommonModule reuses this factory through `DatabaseModule.forRootAsync()` and adds the request session.
The helpers register the Auth entities and all 11 native Queue entities so Job participates in ORM migration comparison.
Its native columns, defaults, enum and operational indexes match BullMQ. The
application migrations add indexes for `data.userId` and `data.workspaceId` and
an authenticated SELECT policy; subsequent comparisons are empty. Supporting tables, enums and foreign keys are mapped by read-only entities.
The standard MikroORM schema generator is used, with native `ignoreRoutines: true`
to preserve existing functions. This option applies to application functions too.
Keep migration snapshots enabled; MikroORM 7.2.0 live-generated rollback SQL can
include ignored routines and must be reviewed. BullMQ owns functions and sequences.
There is no mirror table, event synchronization or extra cleanup timer.
Use BullMQ's `removeOnComplete` / `removeOnFail` options for retention; removing a
job also removes it from queries. Existing legacy mirror rows are not imported.
The read-only `LegacyJob` entity preserves the old `public.job` table and its
historical data until it is archived and removed separately. It has no API.

Register classes extending `BaseQueue` as providers and inject them directly.
Consumers use `@Processor(QueueClass)` and extend `BaseProcessor`. A consumer-only
application also registers its queue provider. For dynamic queue settings, inject business dependencies in a queue constructor
and pass local overrides to `super(localOptions)`; `@Queue()` supplies global configuration automatically. PostgreSQL persistence is always
active; the database and GraphQL integrations are optional read features.
`QueueModule.graphql` defaults to true when the corresponding modules and entity are registered.
Queue declarations default to `expose: false`: the example opts `ReportQueue` in
with `@Queue({ expose: true })`, while the internal Schedule queue stays hidden.
Job API nodes, lists and counts require both queue exposure and the RLS ownership policy.
Direct BullMQ queue operations and persistence remain available for hidden queues.

### Runnable Queue and Schedule example

`AppModule` imports `CommonModule` for shared configuration and `ReportsModule` for
the business providers. In the HTTP application, `QueueModule` is imported only by `CommonModule`; its global
services are available to `ReportsModule` without another registration.

| File                                                         | Responsibility                                                                                                                                                                                |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`report.queue.ts`](src/app/reports/report.queue.ts)         | `@Queue()` and a typed `BaseQueue` subclass named `report-queue`, with retry, backoff and retention defaults. No constructor is needed.                                                       |
| [`report.processor.ts`](src/app/reports/report.processor.ts) | `@Processor(ReportQueue)` and `BaseProcessor`, with concurrency 2. Updates progress and returns count, total and average. Injecting `RequestContext` gives each job its own scoped processor. |
| [`report.schedule.ts`](src/app/reports/report.schedule.ts)   | Directly injects `ReportQueue`. A UTC midnight `@Cron` and five-minute `@Interval` enqueue sample reports. Scheduled handlers only enqueue; the report worker performs the work.              |
| [`reports.module.ts`](src/app/reports/reports.module.ts)     | Registers the queue, processor and scheduled provider, and exports the queue for other modules.                                                                                               |

The scheduled inputs are fixed demonstration values, with no external side effects.
The report calculation is safe to repeat. Real tasks with side effects should also
be idempotent because failed or stalled jobs can run again.

After migrations, start the application with `pnpm --filter @nest-boot/example-server dev`.
Start consumers in a second terminal with `pnpm --filter @nest-boot/example-server queue:run`.
HTTP and REPL processes leave workers inactive. The worker process registers the
two schedules and consumes reports. Use `queue:run --queue report-queue` to run only
the report consumer, or `queue:run --queue schedule` to run only scheduled triggers.
To enqueue a report manually, start the example's Nest REPL:

```bash
pnpm --filter @nest-boot/example-server repl
```

```js
const reports = get(ReportQueue);
const task = await reports.add('summarize', { values: [10, 20, 30] });
// Read a fresh job after the worker processes it.
const completed = await reports.getJob(task.id);
await completed.getState(); // 'completed' once processing finishes
completed.progress; // 100
completed.returnvalue; // { count: 3, total: 60, average: 20 }
```

These background samples have no user/workspace ownership and are hidden from the
authenticated Job API by RLS. To expose a user's report, enqueue it
from trusted application code using the verified identity as shown below. The
worker gets a fresh queue context; it does not inherit the producer's HTTP session.

Assign ownership using the verified server-side identity when enqueueing:

```ts
await reports.add('summarize', {
  userId: user.id,
  workspaceId: workspace.id,
  values: [10, 20, 30],
});
```

The Job RLS policy allows a job when either `data.userId` matches the current user
or `data.workspaceId` matches the selected workspace. Personal tasks can omit the
workspace ID; workspace tasks can omit the user ID. Jobs without a matching identity
are hidden. JobService restricts reads to the exposed-queue allowlist, while RLS
compares those payload fields with
verified `app.user.id` / `app.workspace.id` session variables. Missing or empty
identities match no rows; anonymous reads and request writes have no policy.
BullMQ producers and workers use a separate connection as the table owner (or a
role with `BYPASSRLS`) to process all tenants and background jobs. RLS is not forced
on the owner. Request queries switch to the non-owner `authenticated` role; do not
grant request roles access to the other internal BullMQ tables.

### GraphQL queries

The authenticated `/api/graphql` endpoint exposes `job(id: ID!)` and the `jobs`
connection. Both use the current request's EntityManager session and RLS, so the same
`data.userId OR data.workspaceId` scope applies to returned rows and counts.
An inaccessible or missing job returns `null`. Anonymous requests are rejected
by the application's global `AuthGuard`. Member API keys use their workspace
scope when reading jobs.

```graphql
query Jobs($id: ID!, $after: String, $filter: JobFilter) {
  job(id: $id) {
    id
    queue
    name
    status
    progress
    startedAt
    finishedAt
    createdAt
  }
  jobs(
    first: 20
    after: $after
    filter: $filter
    orderBy: { field: CREATED_AT, direction: DESC }
  ) {
    edges {
      cursor
      node {
        id
        queue
        name
        status
        progress
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
    totalCount
  }
}
```

Example variables:

```json
{
  "id": "report-queue:42",
  "filter": { "queue": "report-queue", "status": "completed" }
}
```

IDs use the computed `queue:jobId` form; the separate `jobId` is not public.
The API exposes only `id`, `queue`, `name`, `status`, numeric `progress` and the
three timestamps. The progress resolver returns null for objects, strings,
booleans and non-finite numbers. Payloads, raw results, failure details and
operational fields stay private. Read the report result through BullMQ on the
server; client-facing business results belong in a separate typed, authorized API.
Output status uses the
`JobStatus` enum (for example `COMPLETED`); status filters use stored values
(for example `completed`). The six statuses map directly to the native `state` column;
waiting jobs with a priority also return `WAITING`. Filters and sorting support `queue`, `name`,
`status` and `created_at`; sorting also supports `ID`. The connection
supports `first`/`after`, `last`/`before`, and search syntax such as
`query: "name:summarize"`. These queries read native BullMQ rows directly; single and bulk enqueues are visible as soon as they complete.

## Member profiles and User privacy

`Member.name` and `email` are independently stored workspace-visible
contact details, initialized once when joining. Display and search these fields,
not `member.user`. User profiles require self access or global user-read permission;
workspace roles and invitation access do not grant private User access.

Built-in `Member` owns name/email, while `Workspace.members` and `User.members`
own the inverse relations. `Workspace.features` and its enum have been removed.

The migration sequence is `Initial → generated schema`. It creates
roles, entity tables, foreign-key cascades, RLS policies
and uniform default privileges on an empty database. Application permissions are
enforced by Services and are not sent to the database. RLS retains ownership,
workspace boundaries; User reads/writes and Session reads rely on
Service authorization. No custom SQL functions or auth schema are needed.
`UserApiKey` and `MemberApiKey` use separate tables with a required `user` or
`member` foreign key respectively; no exclusive-owner CHECK is needed. Deleting a user cascades to
accounts, sessions (also sessions they impersonated), personal keys, members and
sent invitations and those members' keys, but preserves workspaces, service accounts
and other members' keys. Soft deletion does
not trigger database cascades.

This is a replacement baseline, not an incremental upgrade for existing databases.
Do not run it over old tables or merely clear migration history. Back up existing
data and plan a separate data-preserving transition first. Clean old build output
before deployment so removed migration files are not discovered from `dist`.

## Migration ownership

Run all migrations in order:

1. `Migration00000000000000_Initial`: installs `uuid-ossp` and `pgcrypto` in the `extensions` schema, creates request roles and schema grants, and sets ALL default privileges on public tables, functions and sequences for anonymous and authenticated.
2. `Migration20261009070926`: generated by MikroORM from the final beta entities, including auth and job tables, indexes, foreign-key cascades, service account type checks, and RLS policies. It creates separate user and member API-key tables directly. Membership is unique by `(user, workspace)`; contact emails may be shared. No handwritten grants or function definitions are mixed in.
3. `Migration20261011160256_JobIndexes`: adds ownership indexes and grants authenticated reads on the native BullMQ job table, after BullMQ's official migrations.
4. `Migration20261011164129_JobRls`: generated from the Job entity to enable RLS and allow authenticated reads of matching user or workspace jobs.

`migration:create` generates subsequent schema changes from metadata and the
committed snapshot. Handwritten SQL should remain in dedicated migrations.
Do not edit the generated schema migration to change roles, functions, or grants.
Default privileges apply only to future objects created by the same migration role
in `public`; existing tables and objects created by another role are unaffected.
ALL table privileges also include TRUNCATE, REFERENCES, and TRIGGER. RLS does not
protect against TRUNCATE; request roles must not be exposed through unrestricted
SQL execution. Both roles can execute functions and use, read and update sequences.
Review SECURITY DEFINER functions separately: function execution grants are not
restricted by table RLS, and such functions run with their owner's privileges.
New application tables must declare RLS policies. Verification tokens have an
explicit deny policy for request roles. Credential fields remain excluded from
Service results and GraphQL, but are no longer blocked by database column grants.
A full rollback drops generated tables. Initial has a no-op `down()`, so extensions,
schemas, roles and grants remain; reapplying initialization is idempotent.
Extension functions can be called with their `extensions` schema qualifier.
PostgreSQL must have `uuid-ossp` and `pgcrypto` available for installation.
`CREATE EXTENSION IF NOT EXISTS` does not relocate previously installed extensions.
Request roles are shared across the PostgreSQL cluster; existing role settings
are preserved. If the application connects as a different role from the migration
role, grant it membership in `anonymous` and `authenticated` separately.

```bash
pnpm --filter @nest-boot/example-server migration:up
pnpm --filter @nest-boot/example-server migration:create
```

## Verification

```bash
pnpm --filter @nest-boot/example-server build
pnpm --filter @nest-boot/example-server lint
pnpm --filter @nest-boot/example-server test
pnpm --filter @nest-boot/example-server test:e2e
```
