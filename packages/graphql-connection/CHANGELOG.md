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

## 8.0.4 (2026-10-10)

### 🚀 Features

- ⚠️  release Nest Boot v8 ([#413](https://github.com/nest-boot/nest-boot/pull/413))

### ⚠️  Breaking Changes

- release Nest Boot v8  ([#413](https://github.com/nest-boot/nest-boot/pull/413))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.4
- Updated @nest-boot/eslint-config to 8.0.2
- Updated @nest-boot/eslint-plugin to 8.0.1
- Updated @nest-boot/tsconfig to 8.0.0
- Updated @nest-boot/graphql to 8.0.4

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.4-beta.4 (2026-10-10)

### 🩹 Fixes

- **graphql-connection:** upgrade search-syntax to v4 ([#408](https://github.com/nest-boot/nest-boot/pull/408))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.4-beta.3 (2026-10-10)

### 🚀 Features

- ⚠️  **runtime:** require Node 24.21 and validate packed consumers ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### ⚠️  Breaking Changes

- **runtime:** require Node 24.21 and validate packed consumers  ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.4-beta.3
- Updated @nest-boot/eslint-config to 8.0.2-beta.4
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.5
- Updated @nest-boot/tsconfig to 8.0.0-beta.5
- Updated @nest-boot/graphql to 8.0.4-beta.3

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.4-beta.2 (2026-10-10)

### 🩹 Fixes

- **deps:** upgrade production dependencies and Nodemailer 10 ([#405](https://github.com/nest-boot/nest-boot/pull/405))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.4-beta.2
- Updated @nest-boot/graphql to 8.0.4-beta.2

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.4-beta.1 (2026-10-10)

### 🚀 Features

- **eslint-config:** adopt JSDoc and retire TypeDoc ([#404](https://github.com/nest-boot/nest-boot/pull/404))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.4-beta.1
- Updated @nest-boot/eslint-config to 8.0.2-beta.3
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.4
- Updated @nest-boot/graphql to 8.0.4-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.4-beta.0 (2026-10-09)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.4-beta.0
- Updated @nest-boot/eslint-config to 8.0.2-beta.2
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.3
- Updated @nest-boot/graphql to 8.0.4-beta.0

## 8.0.3-beta.0 (2026-10-09)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.3-beta.0
- Updated @nest-boot/eslint-config to 8.0.2-beta.1
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.2
- Updated @nest-boot/graphql to 8.0.3-beta.0

## 8.0.2-beta.1 (2026-09-24)

### 🚀 Features

- refresh example client and normalize date filters ([#375](https://github.com/nest-boot/nest-boot/pull/375))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.2-beta.0 (2026-09-23)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.2-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.1
- Updated @nest-boot/graphql to 8.0.2-beta.0

## 8.0.1-beta.3 (2026-09-20)

### 🩹 Fixes

- **graphql-connection:** paginate nullable sort fields ([#340](https://github.com/nest-boot/nest-boot/pull/340))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.1-beta.2 (2026-09-20)

### 🩹 Fixes

- **graphql-connection:** accept null optional arguments ([#335](https://github.com/nest-boot/nest-boot/pull/335))
- **graphql-rate-limit:** validate connection page sizes ([#338](https://github.com/nest-boot/nest-boot/pull/338))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.1-beta.1 (2026-09-19)

### 🚀 Features

- ⚠️  **auth:** unify auth entities, services and GraphQL APIs ([#331](https://github.com/nest-boot/nest-boot/pull/331))

### ⚠️  Breaking Changes

- **auth:** unify auth entities, services and GraphQL APIs  ([#331](https://github.com/nest-boot/nest-boot/pull/331))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.1-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.0
- Updated @nest-boot/tsconfig to 8.0.0-beta.4
- Updated @nest-boot/graphql to 8.0.1-beta.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.1-beta.0 (2026-09-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/graphql to 8.0.0-beta.4

## 8.0.0-beta.4 (2026-09-16)

### 🚀 Features

- ⚠️  **mikro-orm:** adopt native RLS and remove the custom RLS package ([#329](https://github.com/nest-boot/nest-boot/pull/329))

### ⚠️  Breaking Changes

- **mikro-orm:** adopt native RLS and remove the custom RLS package  ([#329](https://github.com/nest-boot/nest-boot/pull/329))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.0-beta.3 (2026-09-08)

### 🚀 Features

- ⚠️  **auth:** rebuild authentication and authorization ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### ⚠️  Breaking Changes

- **auth:** rebuild authentication and authorization  ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.0-beta.3
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.3
- Updated @nest-boot/tsconfig to 8.0.0-beta.3
- Updated @nest-boot/graphql to 8.0.0-beta.3

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.0-beta.2 (2026-08-31)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.0-beta.2
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.2
- Updated @nest-boot/tsconfig to 8.0.0-beta.2
- Updated @nest-boot/graphql to 8.0.0-beta.2

## 8.0.0-beta.1 (2026-08-31)

### 🚀 Features

- ⚠️  migrate to NestJS 12 and ESM ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### ⚠️  Breaking Changes

- migrate to NestJS 12 and ESM  ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 8.0.0-beta.1
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.1
- Updated @nest-boot/tsconfig to 8.0.0-beta.1
- Updated @nest-boot/graphql to 8.0.0-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.11.1 (2026-08-31)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.3.5
- Updated @nest-boot/eslint-plugin to 7.2.5
- Updated @nest-boot/tsconfig to 7.3.5
- Updated @nest-boot/graphql to 7.3.5

## 7.11.0 (2026-08-29)

### 🚀 Features

- **graphql-connection:** expose bounded total count semantics ([#307](https://github.com/nest-boot/nest-boot/pull/307))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.10.5 (2026-08-29)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.3.4
- Updated @nest-boot/eslint-plugin to 7.2.4
- Updated @nest-boot/tsconfig to 7.3.4
- Updated @nest-boot/graphql to 7.3.4

## 7.10.4 (2026-08-29)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.3.3
- Updated @nest-boot/eslint-plugin to 7.2.3
- Updated @nest-boot/tsconfig to 7.3.3
- Updated @nest-boot/graphql to 7.3.3

## 7.10.3 (2026-08-29)

### 🩹 Fixes

- **graphql-connection:** align cursor tie-break direction ([#303](https://github.com/nest-boot/nest-boot/pull/303))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.10.2 (2026-08-28)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.3.2
- Updated @nest-boot/eslint-plugin to 7.2.2
- Updated @nest-boot/tsconfig to 7.3.2
- Updated @nest-boot/graphql to 7.3.2

## 7.10.1 (2026-08-27)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.3.1
- Updated @nest-boot/eslint-plugin to 7.2.1
- Updated @nest-boot/tsconfig to 7.3.1
- Updated @nest-boot/graphql to 7.3.1

## 7.10.0 (2026-08-12)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.3.0
- Updated @nest-boot/eslint-plugin to 7.2.0
- Updated @nest-boot/tsconfig to 7.3.0
- Updated @nest-boot/graphql to 7.3.0

## 7.9.1 (2026-06-17)

### 🩹 Fixes

- update filter query schema dependency ([#275](https://github.com/nest-boot/nest-boot/pull/275))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.2.1
- Updated @nest-boot/eslint-plugin to 7.1.1
- Updated @nest-boot/tsconfig to 7.2.1
- Updated @nest-boot/graphql to 7.2.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.9.0 (2026-06-17)

### 🚀 Features

- support fulltext field mapping in graphql connection ([#274](https://github.com/nest-boot/nest-boot/pull/274))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.2.0
- Updated @nest-boot/eslint-plugin to 7.1.0
- Updated @nest-boot/tsconfig to 7.2.0
- Updated @nest-boot/graphql to 7.2.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.8.0 (2026-06-07)

### 🚀 Features

- add row level security driver ([#236](https://github.com/nest-boot/nest-boot/pull/236))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-config to 7.1.0
- Updated @nest-boot/eslint-plugin to 7.0.8
- Updated @nest-boot/tsconfig to 7.1.0
- Updated @nest-boot/graphql to 7.1.5

### ❤️ Thank You

- Xudong Huang @xudongcc

# @nest-boot/graphql-connection

## 7.7.2

### Patch Changes

- fadc3d0: fix: disable identity map for count queries in connection query builder

## 7.7.1

### Patch Changes

- 3f42c62: add comprehensive TSDoc coverage and translate comments to English

## 7.7.0

### Minor Changes

- db0a4ba: feat(graphql-connection): support prefix search

## 7.6.3

### Patch Changes

- f242b5b: fix(graphql-connection): pass fulltext option to search-syntax for full-text search

## 7.6.2

### Patch Changes

- 372cb9e: chore: use defineConfig to configure eslint
- 372cb9e: fix: add typedoc

## 7.6.1

### Patch Changes

- fc593f8: fix: upgrade search-syntax

## 7.6.0

### Minor Changes

- 5684aab: feat: connectionBuilder.build newly added return filterQuerySchema

## 7.5.0

### Minor Changes

- 7636d13: feat: support $fulltext

## 7.4.0

### Minor Changes

- ce5c7b7: feat: improve field options handling and add UnknownFieldError for better error management
- ce5c7b7: feat: add zod dependency and enhance connection query builder with filter capabilities
- ce5c7b7: feat: use search-syntax library for query string parsing

## 7.3.0

### Minor Changes

- f1180a5: feat: improve field options handling and add UnknownFieldError for better error management
- f1180a5: feat: add zod dependency and enhance connection query builder with filter capabilities

## 7.2.1

### Patch Changes

- bf35af9: fix: update @nestjs packages to version 11.1.9 across multiple packages

## 7.2.0

### Minor Changes

- 4e8cd0e: feat: ConnectionBuilder 构建结果携带实体名称作为前缀

## 7.1.0

### Minor Changes

- c752bdc: feat: GraphQL Connection Module changed to global module

## 7.0.1

### Patch Changes

- a1a2490: fix: update @nest-boot dependencies to version 7.0.0 across multiple packages

## 7.0.0

### Major Changes

- 14895ac: ESLint 升级到 v9

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- 762ad68: 更新 @nestjs/apollo 依赖版本至 ^13.0.0
- b5e6548: 重新发布版本
- f9c03c3: 修复 ESLint
- Updated dependencies [49659ef]
- Updated dependencies [34591c8]
- Updated dependencies [20f3262]
- Updated dependencies [79ef4a8]
- Updated dependencies [eec2ebc]
- Updated dependencies [b5e6548]
- Updated dependencies [f9c03c3]
- Updated dependencies [14895ac]
- Updated dependencies [aeedd1c]
  - @nest-boot/graphql@7.0.0

## 7.0.0-beta.4

### Patch Changes

- f9c03c3: 修复 ESLint
- Updated dependencies [f9c03c3]
  - @nest-boot/graphql@7.0.0-beta.7

## 7.0.0-beta.3

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- Updated dependencies [20f3262]
  - @nest-boot/graphql@7.0.0-beta.6

## 7.0.0-beta.2

### Patch Changes

- b5e6548: 重新发布版本

## 7.0.0-beta.1

### Patch Changes

- 762ad68: 更新 @nestjs/apollo 依赖版本至 ^13.0.0

## 7.0.0-beta.0

### Major Changes

- 14895ac: ESLint 升级到 v9

## 6.10.4

### Patch Changes

- bcd62cb: fix: Update dependencies across multiple packages to latest versions.
- Updated dependencies [bcd62cb]
  - @nest-boot/database@6.17.1
  - @nest-boot/common@6.10.2

## 6.10.3

### Patch Changes

- d19de29: fix: 固定 chevrotain 版本为 10.5.0

## 6.10.2

### Patch Changes

- 8372590: 更新依赖
- Updated dependencies [8372590]
- Updated dependencies [8372590]
  - @nest-boot/database@6.11.0
  - @nest-boot/common@6.10.1

## 6.10.1

### Patch Changes

- fba38d1: 修复 totalCount 统计不遵守过滤器的问题

## 7.0.0

### Major Changes

- 0bb91b3: 重新实现 GraphQL Connection
