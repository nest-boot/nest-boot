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
pnpm --filter @nest-boot/example-server migration:up
pnpm --filter @nest-boot/example-server queue:migrate
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
Healthy checks return HTTP 200; a failed or timed-out check returns HTTP 503.
The middleware responds before the global auth guard, so the health endpoint
does not require a login.

## Jobs

`JobsModule` uses BullMQ 6's official PostgreSQL backend, configured through
`QUEUE_DATABASE_URL` or `DATABASE_URL`. `ScheduleModule` uses the same backend.
Run application migrations first, then `pnpm --filter @nest-boot/example-server queue:migrate`.
The latter runs BullMQ's own migrations and grants the `authenticated` database
role schema usage and SELECT on `bullmq.job`.

The built-in `Job` from `@nest-boot/queue/persistence` maps that native table through
MikroORM. Both runtime and CLI configurations include the entity and
`jobSchemaGeneratorOptions` to exclude BullMQ's schema from ORM migrations.
There is no mirror table, event synchronization or extra cleanup timer.
Use BullMQ's `removeOnComplete` / `removeOnFail` options for retention; removing a
job also removes it from queries. Existing legacy mirror rows are not imported.
The example also excludes the old `public.job` table from schema generation to
preserve historical data until it is archived and removed separately.

Register classes extending `BaseQueue` as providers and inject them directly.
Consumers use `@Processor(QueueClass)` and extend `BaseProcessor`. A consumer-only
application also registers its queue provider. For dynamic queue settings, inject `QUEUE_MODULE_OPTIONS` in a queue constructor
and pass the defaults and local overrides to `super(moduleOptions, localOptions)`. PostgreSQL persistence is always
active; the database and GraphQL integrations are optional read features.
`graphql` defaults to true when the corresponding modules and entity are registered.

Assign ownership using the verified server-side identity when enqueueing:

```ts
await queue.add('generate-report', {
  userId: user.id,
  workspaceId: workspace.id,
  format: 'csv',
});
```

`getJobReadFilter` allows a job when either `data.userId` matches the current user
or `data.workspaceId` matches the selected workspace. Personal tasks can omit the
workspace ID; workspace tasks can omit the user ID. Jobs without a matching identity
are hidden. This authorization is enforced by JobService, not a tenant RLS policy on
the BullMQ-owned table. Application authentication tables still use their own RLS.

### GraphQL queries

The authenticated `/api/graphql` endpoint exposes `job(id: ID!)` and the `jobs`
connection. Both use the current request's EntityManager and `getJobReadFilter`, so the same
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
    data
    progress
    returnValue
    failedReason
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
  "id": "reports:42",
  "filter": { "queue": "reports", "status": "completed" }
}
```

IDs use the computed `queue:jobId` form. `data`, `progress` and `returnValue`
are JSON scalars and do not take GraphQL subfields. Output status uses the
`JobStatus` enum (for example `COMPLETED`); status filters use stored values
(for example `completed`). Filters and sorting support `queue`, `name`,
`status` and `created_at`; sorting also supports `ID`. The connection
supports `first`/`after`, `last`/`before`, and search syntax such as
`query: "name:generate-report"`. These queries read native BullMQ rows directly; single and bulk enqueues are visible as soon as they complete.

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
