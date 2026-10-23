## 8.0.4

### Patch Changes

- 8b96012: Remove obsolete import migration rules and the implicit MikroORM import migration
  from entity field fixes. Delete custom configuration entries for `import-database`,
  `import-graphql`, `import-mikro-orm`, `import-bullmq`, and `import-queue`, including
  disabled entries, and migrate import paths and APIs manually.

  The shared ESLint config now requires braces around all conditional and loop
  bodies with `curly: ["error", "all"]`. Existing violations can be fixed with
  `eslint --fix`.
- Updated dependencies [8b96012]
  - @nest-boot/eslint-plugin@8.0.3

## 8.0.3

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
  - @nest-boot/eslint-plugin@8.0.2

## 8.0.2 (2026-10-10)

### 🚀 Features

- ⚠️  release Nest Boot v8 ([#413](https://github.com/nest-boot/nest-boot/pull/413))

### ⚠️  Breaking Changes

- release Nest Boot v8  ([#413](https://github.com/nest-boot/nest-boot/pull/413))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 8.0.1
- Updated @nest-boot/tsconfig to 8.0.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.2-beta.4 (2026-10-10)

### 🚀 Features

- ⚠️  **runtime:** require Node 24.21 and validate packed consumers ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### ⚠️  Breaking Changes

- **runtime:** require Node 24.21 and validate packed consumers  ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 8.0.1-beta.5
- Updated @nest-boot/tsconfig to 8.0.0-beta.5

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.2-beta.3 (2026-10-10)

### 🚀 Features

- **eslint-config:** adopt JSDoc and retire TypeDoc ([#404](https://github.com/nest-boot/nest-boot/pull/404))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 8.0.1-beta.4

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.2-beta.2 (2026-10-09)

### 🚀 Features

- ⚠️  **queue:** rename queue integration packages and APIs ([#398](https://github.com/nest-boot/nest-boot/pull/398))

### ⚠️  Breaking Changes

- **queue:** rename queue integration packages and APIs  ([#398](https://github.com/nest-boot/nest-boot/pull/398))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 8.0.1-beta.3

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.2-beta.1 (2026-10-09)

### 🚀 Features

- ⚠️  **database:** rename database integration packages and APIs ([#397](https://github.com/nest-boot/nest-boot/pull/397))

### ⚠️  Breaking Changes

- **database:** rename database integration packages and APIs  ([#397](https://github.com/nest-boot/nest-boot/pull/397))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 8.0.1-beta.2

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.2-beta.0 (2026-09-23)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 8.0.1-beta.1

## 8.0.1-beta.0 (2026-09-19)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 8.0.1-beta.0
- Updated @nest-boot/tsconfig to 8.0.0-beta.4

## 8.0.0-beta.3 (2026-09-08)

### 🚀 Features

- ⚠️  **auth:** rebuild authentication and authorization ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### ⚠️  Breaking Changes

- **auth:** rebuild authentication and authorization  ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 8.0.0-beta.3
- Updated @nest-boot/tsconfig to 8.0.0-beta.3

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.0-beta.2 (2026-08-31)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 8.0.0-beta.2
- Updated @nest-boot/tsconfig to 8.0.0-beta.2

## 8.0.0-beta.1 (2026-08-31)

### 🚀 Features

- ⚠️ migrate to NestJS 12 and ESM ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### ⚠️ Breaking Changes

- migrate to NestJS 12 and ESM ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 8.0.0-beta.1
- Updated @nest-boot/tsconfig to 8.0.0-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.3.5 (2026-08-31)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 7.2.5
- Updated @nest-boot/tsconfig to 7.3.5

## 7.3.4 (2026-08-29)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 7.2.4
- Updated @nest-boot/tsconfig to 7.3.4

## 7.3.3 (2026-08-29)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 7.2.3
- Updated @nest-boot/tsconfig to 7.3.3

## 7.3.2 (2026-08-28)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 7.2.2
- Updated @nest-boot/tsconfig to 7.3.2

## 7.3.1 (2026-08-27)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 7.2.1
- Updated @nest-boot/tsconfig to 7.3.1

## 7.3.0 (2026-08-12)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 7.2.0
- Updated @nest-boot/tsconfig to 7.3.0

## 7.2.1 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 7.1.1
- Updated @nest-boot/tsconfig to 7.2.1

## 7.2.0 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 7.1.0
- Updated @nest-boot/tsconfig to 7.2.0

## 7.1.0 (2026-06-07)

### 🚀 Features

- add row level security driver ([#236](https://github.com/nest-boot/nest-boot/pull/236))

### 🧱 Updated Dependencies

- Updated @nest-boot/eslint-plugin to 7.0.8
- Updated @nest-boot/tsconfig to 7.1.0

### ❤️ Thank You

- Xudong Huang @xudongcc

# @nest-boot/eslint-config

## 7.0.3

### Patch Changes

- 3f42c62: add comprehensive TSDoc coverage and translate comments to English
- Updated dependencies [3f42c62]
  - @nest-boot/eslint-plugin@7.0.5

## 7.0.2

### Patch Changes

- d663833: fix: eslint

## 7.0.1

### Patch Changes

- b7bfd4b: fix: @typescript-eslint/no-misused-spread off

## 7.0.0

### Major Changes

- 14895ac: ESLint 升级到 v9

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- b5e6548: 重新发布版本
- f9c03c3: 修复 ESLint
- Updated dependencies [20f3262]
- Updated dependencies [b5e6548]
- Updated dependencies [f9c03c3]
- Updated dependencies [14895ac]
  - @nest-boot/eslint-plugin@7.0.0

## 7.0.0-beta.3

### Patch Changes

- f9c03c3: 修复 ESLint
- Updated dependencies [f9c03c3]
  - @nest-boot/eslint-plugin@7.0.0-beta.3

## 7.0.0-beta.2

### Patch Changes

- 20f3262: fix: 重构 eslint-plugin 和移除 queue 模块
- Updated dependencies [20f3262]
  - @nest-boot/eslint-plugin@7.0.0-beta.2

## 7.0.0-beta.1

### Patch Changes

- b5e6548: 重新发布版本
- Updated dependencies [b5e6548]
  - @nest-boot/eslint-plugin@7.0.0-beta.1

## 7.0.0-beta.0

### Major Changes

- 14895ac: ESLint 升级到 v9

### Patch Changes

- Updated dependencies [14895ac]
  - @nest-boot/eslint-plugin@7.0.0-beta.0

## 6.10.2

### Patch Changes

- bcd62cb: fix: Update dependencies across multiple packages to latest versions.
- Updated dependencies [bcd62cb]
  - @nest-boot/eslint-plugin@6.10.2

## 6.10.1

### Patch Changes

- 8372590: 更新依赖
- Updated dependencies [8372590]
  - @nest-boot/eslint-plugin@6.10.1
