---
"@nest-boot/queue": minor
---

Integrate the built-in Job entity, history persistence, and authorized GraphQL queries into QueueModule. Discover registered DatabaseModule/GraphQLModule services automatically; registering the Job entity enables history services. Queues record events only when registered with `persist: true` (default false), including async factories. Explicit persistence without database services or the built-in Job metadata fails at startup. This per-queue flag replaces history include/exclude lists. The optional `graphql` setting defaults to true; false disables job queries while keeping history. Database and GraphQL peers are optional, with separate persistence and GraphQL entry points in the queue package.

Remove the queue-database workspace package and replace its example usage with the built-in queue integration. Previously published queue-database versions remain on npm, but new applications and future development use queue. History cleanup no longer requires ScheduleModule. See the queue tutorial for entity discovery, migrations, read scopes, and compatibility guidance.
