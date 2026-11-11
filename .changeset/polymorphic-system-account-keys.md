---
"@nest-boot/auth": minor
"@nest-boot/database": minor
"@nest-boot/graphql-connection": minor
---

Store user, member and independent system-account API keys in one table using a polymorphic owner. Add administrator-session management of system accounts and their keys, explicit platform permissions, database owner integrity and cleanup triggers, and a regenerated fresh-database example baseline. Expose database options to feature registration factories and allow GraphQL connections to query a separate persistent entity. Keep the release in the 8.x series.

Unify GraphQL credential metadata, connections and creation results across all owners. Expose scoped parent-to-key pagination and a nullable owner union generated from active entity and API registrations, without redundant owner identifier fields. Keep scoped inputs and authorization.

Make administration and credential APIs opt-in with `admin.enabled` and `apiKey.enabled`. Personal credentials additionally require `apiKey.user.enabled`; workspace credentials require the workspace feature and `apiKey.workspace.enabled`. System credentials require explicit `apiKey.system.enabled`, which defaults to false independently of administration; only their management APIs require `admin.enabled`. Rename `apiKey.systemAccount.*` to `apiKey.system.*`. Rename `apiKey.member.*` configuration to `apiKey.workspace.*`. Register only enabled models, services, resolvers and owner-integrity triggers, while preserving basic authentication and self-service sessions.

Name scoped credential services `WorkspaceApiKeyService` and `SystemApiKeyService`, with matching file names and public exports.
