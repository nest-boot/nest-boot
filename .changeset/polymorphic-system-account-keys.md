---
"@nest-boot/auth": minor
---

Organize Auth by feature (`common`, `core`, `workspace`, `admin`, `api-key`), retaining entities, services, resolvers, inputs and adjacent unit tests within each feature. Public imports remain available from `@nest-boot/auth`.

Store user, workspace-member and independent system-account API keys in one table using a MikroORM polymorphic relation, global hash uniqueness, and retained audit records after identity deletion. GraphQL exposes distinct `UserApiKey`, `WorkspaceApiKey` and `SystemApiKey` types, each with its own permission enum, connection, input and creation result. Their nullable related identities are `user`, `member` and `systemAccount`; no generic owner union or redundant owner identifiers are exposed.

Make administration and credentials opt-in. All flags default to false: `admin.enabled`, `apiKey.enabled`, `apiKey.user.enabled`, `apiKey.workspace.enabled` and `apiKey.system.enabled`. Workspace credentials additionally require `workspace.enabled`. System authentication is independent of administration, while management requires an administrator session. Use `apiKey.workspace.*` and `apiKey.system.*`, replacing `apiKey.member.*` and `apiKey.systemAccount.*`. Name scoped services `WorkspaceApiKeyService` and `SystemApiKeyService`.

Include example administration pages under `/admin/api-keys` and `/admin/system-accounts`, explicit example feature configuration and a fresh-database migration baseline. Keep the release in the 8.x series.

Define optional API-key owner mappings through native EntitySchema and return ordinary credential-free GraphQL DTOs. Keep other models as decorated entities. Remove global entity metadata rewriting and prototype mutation. Auth shares the application database schema without separate schema options or environment parsing.

Use the Workspace prefix consistently for WorkspaceMember and WorkspaceInvitation entities, services, GraphQL types and root operations, inputs, payloads, enums, decorators and filenames. Use the workspace-member, workspace-service-account and workspace-api-key permission resources. Regenerate example migrations for the automatically named workspace_member and workspace_invitation tables and update the client documents, generated types, permission labels and browser flows.

Filter retired permissions in GraphQL field resolvers without changing stored or effective grants. System-account deletion atomically revokes its retained keys; audit metadata can still be renamed, while grant changes require a live account.

Preserve restricted grants on metadata-only key edits and filter disabled-feature role grants consistently during delegation. Verify concrete DTO authorization conditions without a redundant base discriminator implementation.

Replace API-key `enabled` with a nullable `revokedAt` column and permanent, idempotent revoke operations for all three scopes. Server-generated timestamps cannot be cleared through update inputs. Preserve timestamps under concurrent revocation, refresh authentication state, and synchronize the client, GraphQL schema/types, example migration baseline and snapshot. Keep system-account status and feature activation switches separate.

Remove unused environment-detection helpers and their dedicated inventories/tests, remove the redundant API-key metadata alias and DTO-based persistence narrowing, and keep lifecycle operations on native ORM records. Publish detached credential-free DTOs only at response and request-identity boundaries. Split example API-key owner selection, one-time secret display and audit metadata into controlled components without changing form ownership or permission handling.

Replace static authentication coordinators with injected AuthContext and ApiKeyService providers. Remove runtime service-method replacement and per-call service construction; express privileged persistence boundaries in the services. Keep the ability builder as a pure function and ownership checks as ordinary service-side utilities. Publish request identity changes directly after successful persistence. Require current-credential mutations outside external transactions, consistent with current User/WorkspaceMember authorization changes; reject them before writing. Remove deferred identity publication and the transaction subscriber.

Use atomic credential metadata/revocation writes without dirtying managed snapshots across savepoint rollback. Enforce requested-field authorization consistently across all three credential scopes. Capture usage writes without per-call service construction and preserve usage metadata when persistence fails.
