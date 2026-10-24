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

## 8.0.12

### Patch Changes

- 2d898a6: Use BullMQ 6's official PostgreSQL backend for Queue and Schedule. Configure PostgreSQL through QUEUE_DATABASE_URL, DATABASE_URL or explicit connection options; run BullMQ migrations independently of MikroORM. Remove Redis queue configuration, queue-database, event-based job mirroring, persistence switches and mirror TTL cleanup. Retention uses BullMQ's native removeOnComplete/removeOnFail policies.
  
  Add read-only MikroORM entities for all 11 BullMQ tables, matching enums, defaults, foreign keys and operational indexes. withQueueDatabaseConfig(config) registers the native entities and configures schema comparison with ignoreRoutines; BullMQ retains ownership of functions and independent sequences. Keep migration snapshots enabled and review live-generated rollback SQL. Run BullMQ migrations first, then application migrations to add user/workspace ownership indexes and an authenticated RLS SELECT policy. Request sessions read jobs belonging to their user or workspace; missing identity and request writes are denied. BullMQ connections retain cross-tenant access through the table owner or a BYPASSRLS role; request connections must not bypass RLS. The entity uses queue and jobId as its composite key, with a computed queue:jobId ID for GraphQL and cursor pagination. The public Job API exposes only id, queue, name, status, finite numeric progress and timestamps. Hide jobId, data, returnValue, failedReason, priority and operational fields; applications provide business results separately. A field resolver returns null for non-numeric progress without changing stored BullMQ data. JobStatus maps directly to the six native PostgreSQL states for filtering and sorting; priority waiting jobs return WAITING, and missing jobs return null. Remove the computed status expression, PRIORITIZED and UNKNOWN enum values, and unused graphql-type-json dependency. Native timestamps map to Date fields; updatedAt is removed because the native table has no equivalent. Queue declarations default to expose: false; opt in with @Queue({ expose: true }) to include their jobs in API queries. Remove the getJobReadFilter callback and its generic option type; JobService restricts exposed queues while native RLS enforces ownership through trusted request sessions. Queue exposure and RLS both apply to nodes, filters and counts; internal queues remain hidden without affecting persistence. Queue exports entities, JobService and withQueueDatabaseConfig from its root, removing the persistence subpath. MikroORM core and decorators are required peers. DatabaseModule, GraphQLModule and graphql-connection integrations remain optional, and graphql defaults to true when the integrations are registered.
  
  Replace registerQueue/registerQueueAsync and InjectQueue with injectable @Queue classes extending BaseQueue. @Queue() defaults the queue name to the kebab-cased class name (EmailQueue becomes email-queue), with optional decorator configuration and an explicit name override. BaseQueue merges module defaults, decorator settings and constructor overrides. The decorator supplies application defaults automatically; custom constructors inject only business dependencies and pass local settings to super. No QueueFactory or public module-options injection token is needed. Queues are constructed by Nest; custom factory providers can use ModuleRef.create(). Consumers refer to queue classes via @Processor and extend BaseProcessor; WorkerHost and @nestjs/bullmq compatibility exports are removed. Consumer-only applications also register their queue provider, validated before workers start.
  
  Preserve worker/listener events, health discovery, Nest scopes, durable contexts and graceful shutdown. Establish RequestContext before resolving scoped consumers, and read the active context through static accessors inside handlers. Update Schedule, packed-consumer checks, example application and bilingual documentation. Remove the obsolete import-queue ESLint migration rule and its preset entry; migrate the queue API explicitly.
  
  Import QueueModule once anywhere in the application module tree; AppModule placement is not required. Schedule consumes its global services without importing it internally, removing duplicate queue registration and the separate runtime/configuration forwarding layer.
  
  Remove public autorun options from processors, queue event listeners and ScheduleModule. Selected consumers and listeners start together through queue:run or QueueRegistrar.start(), after connections are ready. Queue providers remain injectable in every entry, including commands that enqueue work. Schedule registers jobs during application startup; select its worker to consume them. Remove the onQueueStart hook. Before the native schema exists, defer schedule registration so queue:migrate can initialize it, then restart the application.
  
  This release stays on v8 with a minor Queue update as requested by the maintainer. Existing Redis jobs and old mirror data are not migrated automatically; drain or migrate them separately before switching deployments.
  
  Schedule accepts queueName for isolating applications sharing one database and schema. Replicas share their application queue name. Validate the complete example migration snapshot against all mapped entities.
- Updated dependencies [2d898a6]
  - @nest-boot/queue@8.1.0

## 8.0.11 (2026-10-10)

### 🚀 Features

- ⚠️  release Nest Boot v8 ([#413](https://github.com/nest-boot/nest-boot/pull/413))

### ⚠️  Breaking Changes

- release Nest Boot v8  ([#413](https://github.com/nest-boot/nest-boot/pull/413))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2
- Updated @nest-boot/eslint-plugin to 8.0.1
- Updated @nest-boot/tsconfig to 8.0.0
- Updated @nest-boot/queue to 8.0.7

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.11-beta.0 (2026-10-10)

### 🧱 Updated Dependencies

- Updated @nest-boot/queue to 8.0.7-beta.4

## 8.0.10-beta.3 (2026-10-10)

### 🚀 Features

- ⚠️  **runtime:** require Node 24.21 and validate packed consumers ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### ⚠️  Breaking Changes

- **runtime:** require Node 24.21 and validate packed consumers  ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.4
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.5
- Updated @nest-boot/tsconfig to 8.0.0-beta.5
- Updated @nest-boot/queue to 8.0.7-beta.3

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.10-beta.2 (2026-10-10)

### 🩹 Fixes

- **deps:** upgrade production dependencies and Nodemailer 10 ([#405](https://github.com/nest-boot/nest-boot/pull/405))

### 🧱 Updated Dependencies

- Updated @nest-boot/queue to 8.0.7-beta.2

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.10-beta.1 (2026-10-10)

### 🚀 Features

- **eslint-config:** adopt JSDoc and retire TypeDoc ([#404](https://github.com/nest-boot/nest-boot/pull/404))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.3
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.4
- Updated @nest-boot/queue to 8.0.7-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.9-beta.1 (2026-10-09)

### 🚀 Features

- ⚠️  **queue:** rename queue integration packages and APIs ([#398](https://github.com/nest-boot/nest-boot/pull/398))

### ⚠️  Breaking Changes

- **queue:** rename queue integration packages and APIs  ([#398](https://github.com/nest-boot/nest-boot/pull/398))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.2
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.3
- Updated @nest-boot/queue to 8.0.6-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.9-beta.0 (2026-10-09)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.1
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.2
- Updated @nest-boot/bullmq to 8.0.6-beta.0

## 8.0.8-beta.0 (2026-10-09)

### 🧱 Updated Dependencies

- Updated @nest-boot/bullmq to 8.0.5-beta.2

## 8.0.7-beta.0 (2026-10-08)

### 🧱 Updated Dependencies

- Updated @nest-boot/bullmq to 8.0.5-beta.1

## 8.0.6-beta.0 (2026-09-23)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.1
- Updated @nest-boot/bullmq to 8.0.5-beta.0

## 8.0.5-beta.0 (2026-09-23)

### 🧱 Updated Dependencies

- Updated @nest-boot/bullmq to 8.0.4-beta.1

## 8.0.4-beta.0 (2026-09-19)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.1-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.0
- Updated @nest-boot/tsconfig to 8.0.0-beta.4
- Updated @nest-boot/bullmq to 8.0.4-beta.0

## 8.0.3-beta.0 (2026-09-08)

### 🚀 Features

- ⚠️  **auth:** rebuild authentication and authorization ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### ⚠️  Breaking Changes

- **auth:** rebuild authentication and authorization  ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.0-beta.3
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.3
- Updated @nest-boot/tsconfig to 8.0.0-beta.3
- Updated @nest-boot/bullmq to 8.0.3-beta.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.0-beta.2 (2026-08-31)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.0-beta.2
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.2
- Updated @nest-boot/tsconfig to 8.0.0-beta.2
- Updated @nest-boot/bullmq to 8.0.0-beta.2

## 8.0.0-beta.1 (2026-08-31)

### 🚀 Features

- ⚠️  migrate to NestJS 12 and ESM ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### ⚠️  Breaking Changes

- migrate to NestJS 12 and ESM  ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.0-beta.1
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.1
- Updated @nest-boot/tsconfig to 8.0.0-beta.1
- Updated @nest-boot/bullmq to 8.0.0-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.3.8 (2026-08-31)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.3.5
- Updated @nest-boot/eslint-plugin to 7.2.5
- Updated @nest-boot/tsconfig to 7.3.5
- Updated @nest-boot/bullmq to 7.3.7

## 7.3.7 (2026-08-29)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.3.4
- Updated @nest-boot/eslint-plugin to 7.2.4
- Updated @nest-boot/tsconfig to 7.3.4
- Updated @nest-boot/bullmq to 7.3.6

## 7.3.6 (2026-08-29)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.3.3
- Updated @nest-boot/eslint-plugin to 7.2.3
- Updated @nest-boot/tsconfig to 7.3.3
- Updated @nest-boot/bullmq to 7.3.5

## 7.3.5 (2026-08-29)

### 🩹 Fixes

- **schedule:** log worker run failures ([#302](https://github.com/nest-boot/nest-boot/pull/302))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.3.4 (2026-08-28)

### 🧱 Updated Dependencies

- Updated @nest-boot/bullmq to 7.3.4

## 7.3.3 (2026-08-28)

### 🧱 Updated Dependencies

- Updated @nest-boot/bullmq to 7.3.3

## 7.3.2 (2026-08-28)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.3.2
- Updated @nest-boot/eslint-plugin to 7.2.2
- Updated @nest-boot/tsconfig to 7.3.2
- Updated @nest-boot/bullmq to 7.3.2

## 7.3.1 (2026-08-27)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.3.1
- Updated @nest-boot/eslint-plugin to 7.2.1
- Updated @nest-boot/tsconfig to 7.3.1
- Updated @nest-boot/bullmq to 7.3.1

## 7.3.0 (2026-08-12)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.3.0
- Updated @nest-boot/eslint-plugin to 7.2.0
- Updated @nest-boot/tsconfig to 7.3.0
- Updated @nest-boot/bullmq to 7.3.0

## 7.2.1 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.2.1
- Updated @nest-boot/eslint-plugin to 7.1.1
- Updated @nest-boot/tsconfig to 7.2.1
- Updated @nest-boot/bullmq to 7.2.1

## 7.2.0 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.2.0
- Updated @nest-boot/eslint-plugin to 7.1.0
- Updated @nest-boot/tsconfig to 7.2.0
- Updated @nest-boot/bullmq to 7.2.0

## 7.1.0 (2026-06-07)

### 🚀 Features

- add row level security driver ([#236](https://github.com/nest-boot/nest-boot/pull/236))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.1.0
- Updated @nest-boot/eslint-plugin to 7.0.8
- Updated @nest-boot/tsconfig to 7.1.0
- Updated @nest-boot/bullmq to 7.1.0

### ❤️ Thank You

- Xudong Huang @xudongcc

# @nest-boot/schedule

## 7.0.3

### Patch Changes

- 3f42c62: add comprehensive TSDoc coverage and translate comments to English
- Updated dependencies [3f42c62]
  - @nest-boot/bullmq@7.0.3

## 7.0.2

### Patch Changes

- 372cb9e: chore: use defineConfig to configure eslint
- 372cb9e: fix: add typedoc
- Updated dependencies [372cb9e]
- Updated dependencies [372cb9e]
  - @nest-boot/bullmq@7.0.2

## 7.0.1

### Patch Changes

- bf35af9: fix: update @nestjs packages to version 11.1.9 across multiple packages
- Updated dependencies [bf35af9]
  - @nest-boot/bullmq@7.0.1

## 7.0.0

### Major Changes

- 9895ff6: fix: 修复 removeOnComplete 和 removeOnFail 参数使用错误
- 14895ac: ESLint 升级到 v9

### Minor Changes

- 2ff1783: feat: mikro-orm、redis、schedule 默认从环境变量读取配置
- 81fae6e: feat: mikro-orm, schedule, bullmq 非动态模块也能直接使用
- fa9731d: fix: add autorun option to ScheduleModuleOptions and update ScheduleProcessor to support it
- 3a17f44: refactor: migrate schedule module to use @nestjs/bullmq, update interfaces and implement schedule processor

### Patch Changes

- 49659ef: fix: 移除 database 和 health-check 模块并格式化代码
- 4c7c772: Forced upgrade version
- f5a64fc: fix: 修复 schedule 错误的导入 bullmq 模块
- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- 50216e0: fix: 优化获取配置的方式
- 2fe46e6: fix: 修复启动逻辑
- 79ef4a8: 移除 @nest-boot/common 依赖
- b5e6548: 重新发布版本
- f9c03c3: 修复 ESLint
- Updated dependencies [d9b1965]
- Updated dependencies [0b05db2]
- Updated dependencies [20f3262]
- Updated dependencies [81fae6e]
- Updated dependencies [50216e0]
- Updated dependencies [3a447d2]
- Updated dependencies [f9c03c3]
  - @nest-boot/bullmq@7.0.0

## 7.0.0-beta.15

### Patch Changes

- f9c03c3: 修复 ESLint
- Updated dependencies [f9c03c3]
  - @nest-boot/bullmq@7.0.0-beta.9

## 7.0.0-beta.14

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- Updated dependencies [20f3262]
  - @nest-boot/bullmq@7.0.0-beta.8
