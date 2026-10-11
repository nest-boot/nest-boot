---
"@nest-boot/queue": minor
"@nest-boot/schedule": patch
"@nest-boot/request-context": minor
"@nest-boot/eslint-plugin": patch
---

Integrate the built-in Job entity, job persistence, and authorized GraphQL queries into QueueModule. Discover registered DatabaseModule/GraphQLModule services automatically; registering the Job entity enables JobService. Queues record events only when registered with `persistence: { enabled: true }` (disabled by default), including async factories. Explicit persistence without database services or the built-in Job metadata fails at startup. This per-queue setting replaces history include/exclude lists. The optional `graphql` setting defaults to true; false disables job queries while keeping persistence. Database and GraphQL peers are optional, with separate persistence and GraphQL entry points in the queue package.

Remove the queue-database workspace package and replace its example usage with the built-in queue integration. Previously published queue-database versions remain on npm, but new applications and future development use queue. Job cleanup no longer requires ScheduleModule. Local job writes are ordered per job, preventing a slow earlier write from overwriting a later result; independent jobs can still write concurrently. See the queue tutorial for entity discovery, migrations, read scopes, and compatibility guidance.

Configure each queue with `persistence: JobPersistenceOptions`: `enabled` defaults to false and `ttl` overrides the module's default `persistence.ttl` (milliseconds, default 30 days). There is no global enable switch. Cleanup applies each enabled queue's own TTL and leaves disabled or unregistered queues untouched. Persist the built-in job fields directly without a custom conversion callback. A single `JobService` owns persistence, cleanup, and authorized queries; each database row stores the latest observed task state rather than an event history.

Replace named `registerQueue` / `registerQueueAsync` calls and `InjectQueue` with injectable classes decorated by `@Queue({ name, ...options })` and extending `BaseQueue`. Register queue classes as providers and inject them directly. Use `QueueFactory.create()` in normal Nest factory providers for dynamic options. Consumers refer to the queue class via `@Processor(QueueClass)` and extend `BaseProcessor`; remove the `WorkerHost` export without an alias. Consumer-only applications also register the queue provider. A missing provider fails startup before any worker starts.

Use BullMQ directly and remove the `@nestjs/bullmq` dependency and its re-exported registration helpers. Preserve worker and explicit queue events, automatic health discovery, scoped consumers, dependency scope propagation, durable context strategies and graceful shutdown. All observed Queue and Worker events upsert persisted rows, including enqueue events for reused job IDs. Update Schedule to use its own queue class.

Establish the task request context before resolving consumer dependencies. Export a request-scoped `RequestContext` provider from `RequestContextModule` for constructor injection; existing static access remains available to singleton services. Import migration lint fixes now avoid rewriting removed or incompatible BullMQ helpers into invalid Nest Boot imports.

This release stays on v8 with a minor queue update as requested by the maintainer. The replaced queue registration API requires the migration above; see the bilingual queue tutorial for examples.
