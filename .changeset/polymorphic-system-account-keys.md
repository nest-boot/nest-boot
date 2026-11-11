---
"@nest-boot/auth": minor
---

Organize Auth by feature (`common`, `core`, `workspace`, `admin`, `api-key`), retaining entities, services, resolvers, inputs and adjacent unit tests within each feature. Public imports remain available from `@nest-boot/auth`.

Store user, workspace-member and independent system-account API keys in one table using a MikroORM polymorphic relation, global hash uniqueness, and retained audit records after identity deletion. GraphQL exposes distinct `UserApiKey`, `WorkspaceApiKey` and `SystemApiKey` types, each with its own permission enum, connection, input and creation result. Their nullable related identities are `user`, `member` and `systemAccount`; no generic owner union or redundant owner identifiers are exposed.

Make administration and credentials opt-in. All flags default to false: `admin.enabled`, `apiKey.enabled`, `apiKey.user.enabled`, `apiKey.workspace.enabled` and `apiKey.system.enabled`. Workspace credentials additionally require `workspace.enabled`. System authentication is independent of administration, while management requires an administrator session. Use `apiKey.workspace.*` and `apiKey.system.*`, replacing `apiKey.member.*` and `apiKey.systemAccount.*`. Name scoped services `WorkspaceApiKeyService` and `SystemApiKeyService`.

Include example administration pages under `/admin/api-keys` and `/admin/system-accounts`, explicit example feature configuration and a fresh-database migration baseline. Keep the release in the 8.x series.
