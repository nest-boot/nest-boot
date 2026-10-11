---
"@nest-boot/queue": minor
"@nest-boot/schedule": patch
"@nest-boot/request-context": minor
"@nest-boot/eslint-plugin": patch
---

Use BullMQ 6's official PostgreSQL backend for Queue and Schedule. Configure PostgreSQL through QUEUE_DATABASE_URL, DATABASE_URL or explicit connection options; run BullMQ migrations independently of MikroORM. Remove Redis queue configuration, queue-database, event-based job mirroring, persistence switches and mirror TTL cleanup. Retention uses BullMQ's native removeOnComplete/removeOnFail policies.

Add a read-only MikroORM mapping of the BullMQ-owned job table, excluded from ORM migrations. The entity uses queue and jobId as its composite key, with a computed queue:jobId ID for GraphQL and cursor pagination. Native timestamps map to Date fields; updatedAt is removed because the native table has no equivalent. Read authorization applies to nodes, filters and counts. DatabaseModule, GraphQLModule and graphql-connection integrations remain optional, and graphql defaults to true when the integrations are registered.

Replace registerQueue/registerQueueAsync and InjectQueue with injectable @Queue classes extending BaseQueue. Use QueueFactory in Nest factory providers for dynamic options. Consumers refer to queue classes via @Processor and extend BaseProcessor; WorkerHost and @nestjs/bullmq compatibility exports are removed. Consumer-only applications also register their queue provider, validated before workers start.

Preserve worker/listener events, health discovery, Nest scopes, durable contexts and graceful shutdown. Establish RequestContext before resolving scoped consumers, and export its injectable request-scoped provider. Update Schedule, ESLint import migration guidance, packed-consumer checks, example application and bilingual documentation.

Register QueueModule once at the application level. Schedule consumes its global services without importing it internally, removing duplicate queue registration and the separate runtime/configuration forwarding layer.

This release stays on v8 with a minor Queue update as requested by the maintainer. Existing Redis jobs and old mirror data are not migrated automatically; drain or migrate them separately before switching deployments.
