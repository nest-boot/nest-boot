# Example server

NestJS API used by the full-stack Nest Boot example. It demonstrates
authentication, permission checks, GraphQL connections, MikroORM,
PostgreSQL row-level security, Redis-backed BullMQ jobs, middleware, request context,
logging, and application commands.

## Run locally

Start the repository development services, create the local environment file,
and run the server:

```bash
docker compose up -d
cp examples/server/.env.example examples/server/.env
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

`CommonModule` configures the global DatabaseModule and Redis-backed QueueModule through REDIS_URL, and imports QueueApiModule for authenticated Job queries and persistence. QueueModule itself requires no database, GraphQL or auth modules; queue-api reuses the application’s configured global modules. `ScheduleModule` uses the same Redis connection. Queue storage and processing require no database migrations. Automatic QueueEvents readers run in every application entry; business workers are started with `queue:start`.

The Job history table is managed by the application's ordinary database migrations. A database-generated UUID identifies history records; the original BullMQ ID is stored as `jobId`. The built-in `job` worker consumes deduplicated snapshots and cleanup tasks and runs with `queue:start` when no queue filter is provided. Run it alone with `nb queue:start --queue job`. Reads are asynchronous; removing a Redis job leaves its history intact. A daily scheduler at 00:00 UTC removes records whose last event is more than 30 days old in batches of 1000, regardless of status. Records with `lastEventMs = 0` use `createdAt` instead. Redis jobs remain intact; a later event recreates a deleted record with a new UUID.

The history bootstrap migration creates the table before the existing index/RLS migrations. Existing native PostgreSQL history is retained as `queue_legacy.job`; new Redis jobs receive separate UUID history. Drain or separately migrate operational jobs before switching transports; database migration does not move pending jobs to Redis.

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
3. `Migration20261013084102_QueueJobs`: generated from the Job entity to add ownership indexes, enable RLS, and allow reads of matching user or workspace jobs, after the compatibility history-table migration. Its generated rollback restores the previous indexes and RLS state.
4. `Migration20261013084103_QueueJobAccess`: grants authenticated schema usage and Job SELECT privileges after RLS is installed. Rollback revokes those privileges before the generated schema migration disables RLS, keeping request reads denied.

`Migration20261023000000_RedisJobHistory` archives earlier tables and introduces the ordinary Job entity with database-generated UUIDs, event-version columns and scoped cursor indexes. The new Job table has no RLS: JobService enforces user/workspace ownership, and administrator-only system queries match records with neither owner. ReportQueue uses the parameterless `@QueueVisible()` decorator to enable API reads; unmarked queues still persist but remain hidden. GraphQL exposes userJob/userJobs, workspaceJob/workspaceJobs and systemJob/systemJobs; unscoped job/jobs are removed. Other application RLS policies remain unchanged. Queue-api owns the focused query, visibility and authorization suites in `packages/queue-api/test`; the example integration suite verifies the configured application with real sessions and member API keys.

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
New application tables declare RLS policies; Job history is an explicit exception protected by its scoped service queries. Verification tokens have an
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
