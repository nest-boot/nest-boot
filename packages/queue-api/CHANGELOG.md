# @nest-boot/queue-api

## 8.1.1

### Patch Changes

- 5278540: Add built-in `nb database:*` commands for database creation, migrations, schema management, and seeders. Commands use the application's initialized ORM, return CLI exit codes, and close resources through CommandFactory. Schema create/update/drop print SQL unless `--run` is supplied.
  
  Enable module entity auto-loading by default and add `DatabaseModule.forFeatureAsync` for configuration-dependent entity registration before ORM initialization. Include migration and seeder extensions in framework defaults. The database package now requires `@nest-boot/command`.
  
  AuthModule automatically registers its existing entities with DatabaseModule, including asynchronous module options. Remove `withAuthDatabaseConfig` and use the application CLI module graph for database commands. Auth now requires the DatabaseModule integration. QueueApiModule automatically registers its Job history entity. Move custom standalone MikroORM configuration into DatabaseModule; the example removes its config file and switches migration/seeder scripts to `nb`.
- 58faaca: Make workspace features opt-in with `workspace: { enabled: true }`. Omission, an empty object, and `enabled: false` now load only base authentication. Workspace, member, invitation, service-account, and member API-key services and GraphQL APIs are available only when enabled. Disabled middleware ignores workspace selectors and does not query member credentials or memberships; its default user roles no longer grant workspace creation.
  
  AuthModule selects base or workspace entities from the resolved synchronous or asynchronous options. The exported `entities` array contains base authentication entities and `workspaceEntities` contains the optional models for direct ORM consumers. Remove the inverse `User.members` collection to prevent discovery of optional entities; use `WorkspaceMemberService` instead. Existing workspace users must explicitly enable `workspace: { enabled: true }`.
- Updated dependencies [5278540]
- Updated dependencies [49c8b4e]
- Updated dependencies [9c70019]
- Updated dependencies [58faaca]
- Updated dependencies [5732acb]
  - @nest-boot/database@8.2.0
  - @nest-boot/auth@8.2.0
  - @nest-boot/graphql-connection@8.2.0

## 8.1.0

### Minor Changes

- f21d5e5: Use Redis for queue state and processing without database migrations. QueueModule
  provides singleton queues, explicitly started Workers, native QueueEvents readers
  and health checks without database, GraphQL, auth or schedule dependencies.
  QueueManager discovers queues once, creates readers in producer-only applications
  as well as Workers, and exposes start(queueNames?) and stop(queueNames?) for
  consumer lifecycle management. Replace queue:run with queue:start; omitted filters
  start every registered consumer, selected names apply uniformly, and unknown names
  fail before starting Workers. Readers use BullMQ's default position without
  replaying retained events on startup.
  
  Move Job persistence, GraphQL queries and the standard JobQueue / JobProcessor
  into the optional @nest-boot/queue-api package. Import QueueApiModule alongside the
  application's global DatabaseModule, GraphQLModule and configured AuthModule.
  Import JobEntity, JobStatus, JobService and JobResolver from queue-api; the task
  type Job<Q, N> and its JobName / JobResult helpers remain in queue. AuthGuard
  protects queries, while JobService scopes records and counts using trusted auth
  identity without Job RLS. JobService injects EntityManager directly and provides
  scoped single-record and paginated reads across queues without generic CRUD.
  
  Add the parameterless @QueueVisible() decorator to queue-api. Scoped single-record
  reads, pages and counts only include queues registered in the API application with
  an explicit marker on their concrete class. Unmarked, inherited-only and
  unregistered queues stay hidden; an empty visible set returns no records. Existing
  authorization checks still apply, and synchronization and cleanup are independent
  of API visibility.
  
  Queue-api forwards source events to the built-in job queue with 24-hour
  deduplication by qualified source name and Redis Stream ID. Job records use
  database-generated UUIDs and ordinary application migrations. Atomic bigint
  lastEventMs / lastEventSeq checks prevent duplicate or out-of-order events from
  overwriting newer records. Shutdown drains source Workers, readers and pending
  snapshots, then the Job Worker. Daily cleanup runs at 00:00 UTC using BullMQ Job
  Scheduler directly, with no schedule dependency. It removes records whose last
  event is more than 30 days old in guarded batches of 1000, regardless of status,
  falling back to createdAt when lastEventMs is zero. Redis jobs remain intact;
  a later event recreates deleted history with a new UUID.
  
  Declare static names with @Queue(name), or use @Queue() to derive a kebab-case name
  from the class. Runtime options belong in constructors. Declare jobSchemas with
  Zod object data and optional result schemas, and implement one typed processXXX
  method per job on singleton @Processor(QueueClass) classes. Parameter and Promise
  result types are checked for each job, optional Worker arguments are constrained,
  and names that map to the same handler are rejected. Unknown jobs and missing
  handlers fail without automatic retries. Validate with parseAsync at submission,
  processing and completion, discard parsed results, and retain original z.input
  values across processing and retries. Native updateData remains unchanged.
  
  Use read-only processor.worker and queue.queueEvents accessors backed by internal
  Symbols. Remove legacy event decorators, QueueEventsHost, Processor.on wrappers,
  the generic process(job) handler, module configuration helpers, database queue
  storage and queue:migrate. Update Schedule to the same typed queue API. Add the
  @nest-boot/queue/processor-name rule to require matching queue and processor class
  prefixes, enable it in the shared config, and remove obsolete migration rules.
  
  Restrict Job connection sorting to CREATED_AT, defaulting to descending creation
  time with UUID as the internal tie-breaker. Keep queue, name and status filtering.
  Use identity-first expression indexes on (userId, created_at, id) and
  (workspaceId, created_at, id) for cross-queue scoped reads. ConnectionBuilder respects
  an explicit sortable: false declaration for id while retaining its default
  behavior for other connections. Correct OrderInterface.field to represent the
  entity path received after GraphQL enum coercion.
  
  Split Job GraphQL reads into userJob/userJobs, workspaceJob/workspaceJobs and
  systemJob/systemJobs. Scope every single-record read, page and count in JobService;
  remove unscoped job/jobs and getJob/getJobConnection. Workspace reads reuse auth's
  active-membership and read checks. System reads require a configured administrator
  session and match only records whose userId and workspaceId are absent or JSON
  null; API keys do not inherit administrator access. Remove Job RLS policies and
  session-variable requirements, keeping other entity policies unchanged. Add a
  partial system-task cursor index. Direct ORM access remains a trusted internal
  API without ownership enforcement.

### Patch Changes

- Updated dependencies [f21d5e5]
  - @nest-boot/queue@8.2.0
  - @nest-boot/graphql-connection@8.1.0
