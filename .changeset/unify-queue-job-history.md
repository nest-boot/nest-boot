---
"@nest-boot/queue": minor
---

Integrate the built-in Job entity, history persistence, and authorized GraphQL queries into QueueModule. Discover registered DatabaseModule/GraphQLModule services automatically; registering the Job entity enables history, while plain queue applications keep their existing behavior. The optional `graphql` setting defaults to true; false disables job queries while keeping history. Database and GraphQL peers are optional, with separate persistence and GraphQL entry points in the queue package.

Remove the queue-database workspace package and replace its example usage with the built-in queue integration. Previously published queue-database versions remain on npm, but new applications and future development use queue. History cleanup no longer requires ScheduleModule. See the queue tutorial for entity discovery, migrations, read scopes, and compatibility guidance.
