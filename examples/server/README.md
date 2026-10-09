# Example server

NestJS API used by the full-stack Nest Boot example. It demonstrates
authentication, permission checks, GraphQL connections, MikroORM,
PostgreSQL row-level security, BullMQ job history, middleware, request context,
and logging.

## Run locally

Start the repository development services, create the local environment file,
and run the server:

```bash
docker compose up -d
cp examples/server/.env.example examples/server/.env
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

## Job history

`JobsModule` registers `QueueDatabaseModule` with a concrete `Job` entity,
plus `QueueModule` and `ScheduleModule` for Redis connections and hourly history
cleanup. Redis/Valkey must be running at `REDIS_URL`; `BULLMQ_PREFIX` separates
this application's queues from other applications using the same Redis database.
Both the application and the migration CLI discover `Job` through their entity
globs. Run migrations before starting the application.

`Job` inherits `JobEntity.data`, stored as PostgreSQL `jsonb`, so the complete
BullMQ payload is preserved. When adding a task to a registered queue, put the
authenticated user/workspace identifiers in that payload as strings:

```ts
await queue.add('generate-report', {
  userId: user.id,
  workspaceId: workspace.id,
  format: 'csv',
});
```

Use identifiers from the authorized server-side identity. Personal tasks can omit
`workspaceId`; workspace tasks can omit `userId`. The `job` RLS policy grants the
authenticated role access when **either** `data.userId` matches `app.user.id`
**or** `data.workspaceId` matches `app.workspace.id`. The same condition applies
to existing rows and inserted/updated payloads. A user's own task remains visible
when another workspace is selected; another user's task is visible when it belongs
to the current workspace. Anonymous requests and tasks with neither identity
matching are denied. Service-level authorization still controls which operations
the application exposes.

Background tasks without either identifier, including the history cleanup job,
remain available to the background database connection but are hidden from request
roles. The integration copies `data` directly; no extra owner columns or custom
`convertJobToEntityData` mapping are needed. History is retained for 30 days by
default. `includeQueues` and `excludeQueues` can limit which registered queues are
persisted.

### GraphQL queries

The authenticated `/api/graphql` endpoint exposes `job(id: ID!)` and the `jobs`
connection. Both use the current request's EntityManager, so the same
`data.userId OR data.workspaceId` RLS rule applies to returned rows and counts.
An inaccessible or missing job returns `null`. Anonymous requests are rejected
by the application's global `AuthGuard`. Member API keys use their workspace
scope when reading history.

```graphql
query JobHistory($id: ID!, $after: String, $filter: JobFilter) {
  job(id: $id) {
    id
    queueName
    name
    status
    data
    progress
    returnValue
    failedReason
    startedAt
    finishedAt
    createdAt
    updatedAt
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
        queueName
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
  "filter": { "queue_name": "reports", "status": "completed" }
}
```

IDs use the persisted `queueName:jobId` form. `data`, `progress` and `returnValue`
are JSON scalars and do not take GraphQL subfields. Output status uses the
`JobStatus` enum (for example `COMPLETED`); status filters use stored values
(for example `completed`). Filters and sorting support `queue_name`, `name`,
`status`, `created_at` and `updated_at`; sorting also supports `ID`. The connection
supports `first`/`after`, `last`/`before`, and search syntax such as
`query: "name:generate-report"`. These queries read the persisted history;
changes become visible after BullMQ events have been synchronized.

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
