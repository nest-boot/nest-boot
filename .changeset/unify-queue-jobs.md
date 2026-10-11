---
"@nest-boot/queue": minor
---

Integrate the built-in Job entity, job persistence, and authorized GraphQL queries into QueueModule. Discover registered DatabaseModule/GraphQLModule services automatically; registering the Job entity enables JobService. Queues record events only when registered with `persist: true` (default false), including async factories. Explicit persistence without database services or the built-in Job metadata fails at startup. This per-queue flag replaces history include/exclude lists. The optional `graphql` setting defaults to true; false disables job queries while keeping persistence. Database and GraphQL peers are optional, with separate persistence and GraphQL entry points in the queue package.

Remove the queue-database workspace package and replace its example usage with the built-in queue integration. Previously published queue-database versions remain on npm, but new applications and future development use queue. Job cleanup no longer requires ScheduleModule. Local job writes are ordered per job, preventing a slow earlier write from overwriting a later result; independent jobs can still write concurrently. See the queue tutorial for entity discovery, migrations, read scopes, and compatibility guidance.

Use `job: JobOptions` for persistence settings. A single `JobService` owns persistence, cleanup, and authorized queries; each database row stores the latest observed task state rather than an event history.
