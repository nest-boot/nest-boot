## 8.3.0

### Minor Changes

- 618e81f: Separate workspace selection from authentication. Rename the request decorators to AuthUser, AuthSession, AuthApiKey, AuthWorkspaceMember, AuthWorkspace and SelectedWorkspace, while preserving currentUser, currentSession and currentWorkspaceMember GraphQL names. Expose selection through selectedWorkspace and authenticated workspace scope through currentWorkspace. Rename authentication response user data to AuthUserData. Update example clients and preserve the 8.x release series.
  
  Header selection takes precedence over the workspace Cookie for all credential types. Selection does not require membership or grant permissions. WorkspaceApiKey requires explicit selection for private access, applies member grants only in its owning workspace, and can access other workspaces through explicit public-resource rules. Malformed selectors return 400; empty headers clear selection and unknown IDs do not fall back to the Cookie.
  
  Project authenticated user, active workspace member, authenticated workspace and selected target into app.auth.user.id, app.auth.workspace_member.id, app.auth.workspace.id and app.selected.workspace.id. System credentials use the existing authenticated role and derive workspace scope from effective account/key/configuration grants without a database system-account identifier. Keep request context preparation outside business transactions. Generate example policy migrations from the native ORM metadata.
  
  Retain captured API-key usage auditing when member credentials access public resources outside their owning workspace, without changing the business request's scope.
  
  Use entity classes as authenticated identity tokens and SELECTED_WORKSPACE for independent selection. Resolve cleanup managers from RequestContext while keeping explicit persistence entry-point managers and standard Nest service injection. Update queue-api token consumption.

### Patch Changes

- Updated dependencies [783c5cd]
  - @nest-boot/database@8.3.0

## 8.2.0

### Minor Changes

- 5278540: Add built-in `nb database:*` commands for database creation, migrations, schema management, and seeders. Commands use the application's initialized ORM, return CLI exit codes, and close resources through CommandFactory. Schema create/update/drop print SQL unless `--run` is supplied.
  
  Enable module entity auto-loading by default and add `DatabaseModule.forFeatureAsync` for configuration-dependent entity registration before ORM initialization. Include migration and seeder extensions in framework defaults. The database package now requires `@nest-boot/command`.
  
  AuthModule automatically registers its existing entities with DatabaseModule, including asynchronous module options. Remove `withAuthDatabaseConfig` and use the application CLI module graph for database commands. Auth now requires the DatabaseModule integration. QueueApiModule automatically registers its Job history entity. Move custom standalone MikroORM configuration into DatabaseModule; the example removes its config file and switches migration/seeder scripts to `nb`.
- 58faaca: Make workspace features opt-in with `workspace: { enabled: true }`. Omission, an empty object, and `enabled: false` now load only base authentication. Workspace, member, invitation, service-account, and member API-key services and GraphQL APIs are available only when enabled. Disabled middleware ignores workspace selectors and does not query member credentials or memberships; its default user roles no longer grant workspace creation.
  
  AuthModule selects base or workspace entities from the resolved synchronous or asynchronous options. The exported `entities` array contains base authentication entities and `workspaceEntities` contains the optional models for direct ORM consumers. Remove the inverse `User.members` collection to prevent discovery of optional entities; use `WorkspaceMemberService` instead. Existing workspace users must explicitly enable `workspace: { enabled: true }`.
- 5732acb: Organize Auth by feature (`common`, `core`, `workspace`, `admin`, `api-key`), retaining entities, services, resolvers, inputs and adjacent unit tests within each feature. Public imports remain available from `@nest-boot/auth`.
  
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
  
  Create system and workspace service accounts atomically with their API keys when the owner ID is omitted. Use existing owners when supplied and preserve separate owner-creation authorization. Move system-account selection into CreateSystemApiKeyInput and align scoped GraphQL operation names across creation, updates, deletion and revocation. Remove frontend two-phase owner creation and retry caches. Enforce all caller-controlled credential creation fields consistently across user, workspace and system keys.
  
  Bind self-service and session revocation to the verified request session, rejecting API-key principals and stale incoming credentials. Validate issued sessions before publishing authentication cookies. Check invitation recipients before exposing status, and accept an explicit null email when creating a workspace service account.

### Patch Changes

- Updated dependencies [5278540]
- Updated dependencies [49c8b4e]
- Updated dependencies [9c70019]
  - @nest-boot/database@8.2.0
  - @nest-boot/graphql-connection@8.2.0

## 8.1.0

### Minor Changes

- 2d898a6: Rename the database configuration loader from loadConfigFromEnv() to getDatabaseConfig(), removing the old export. Update imports and calls to use getDatabaseConfig(). Add withAuthDatabaseConfig(config) to register built-in Auth entities for runtime and CLI discovery without manual array construction. The helpers preserve application configuration, return new objects and deduplicate entity registrations. Compose them with Queue's withQueueDatabaseConfig and reuse the configuration factory in DatabaseModule.forRootAsync; the example no longer needs any casts.

## 8.0.11 (2026-10-10)

### 🚀 Features

- ⚠️  release Nest Boot v8 ([#413](https://github.com/nest-boot/nest-boot/pull/413))

### ⚠️  Breaking Changes

- release Nest Boot v8  ([#413](https://github.com/nest-boot/nest-boot/pull/413))

### 🧱 Updated Dependencies

- Updated @nest-boot/graphql-connection to 8.0.4
- Updated @nest-boot/request-context to 8.0.4
- Updated @nest-boot/eslint-config to 8.0.2
- Updated @nest-boot/eslint-plugin to 8.0.1
- Updated @nest-boot/middleware to 8.0.4
- Updated @nest-boot/validator to 8.0.7
- Updated @nest-boot/tsconfig to 8.0.0
- Updated @nest-boot/graphql to 8.0.4
- Updated @nest-boot/mailer to 8.0.4
- Updated @nest-boot/hash to 8.0.4

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.11-beta.0 (2026-10-10)

### 🧱 Updated Dependencies

- Updated @nest-boot/mailer to 8.0.4-beta.4

## 8.0.10-beta.0 (2026-10-10)

### 🧱 Updated Dependencies

- Updated @nest-boot/graphql-connection to 8.0.4-beta.4

## 8.0.9-beta.4 (2026-10-10)

### 🚀 Features

- ⚠️  **runtime:** require Node 24.21 and validate packed consumers ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### ⚠️  Breaking Changes

- **runtime:** require Node 24.21 and validate packed consumers  ([#406](https://github.com/nest-boot/nest-boot/pull/406))

### 🧱 Updated Dependencies

- Updated @nest-boot/graphql-connection to 8.0.4-beta.3
- Updated @nest-boot/request-context to 8.0.4-beta.3
- Updated @nest-boot/eslint-config to 8.0.2-beta.4
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.5
- Updated @nest-boot/middleware to 8.0.4-beta.2
- Updated @nest-boot/validator to 8.0.7-beta.2
- Updated @nest-boot/tsconfig to 8.0.0-beta.5
- Updated @nest-boot/graphql to 8.0.4-beta.3
- Updated @nest-boot/mailer to 8.0.4-beta.3
- Updated @nest-boot/hash to 8.0.4-beta.2

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.9-beta.3 (2026-10-10)

### 🩹 Fixes

- **deps:** upgrade production dependencies and Nodemailer 10 ([#405](https://github.com/nest-boot/nest-boot/pull/405))

### 🧱 Updated Dependencies

- Updated @nest-boot/graphql-connection to 8.0.4-beta.2
- Updated @nest-boot/request-context to 8.0.4-beta.2
- Updated @nest-boot/graphql to 8.0.4-beta.2
- Updated @nest-boot/mailer to 8.0.4-beta.2

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.9-beta.2 (2026-10-10)

### 🚀 Features

- **eslint-config:** adopt JSDoc and retire TypeDoc ([#404](https://github.com/nest-boot/nest-boot/pull/404))

### 🧱 Updated Dependencies

- Updated @nest-boot/graphql-connection to 8.0.4-beta.1
- Updated @nest-boot/request-context to 8.0.4-beta.1
- Updated @nest-boot/eslint-config to 8.0.2-beta.3
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.4
- Updated @nest-boot/middleware to 8.0.4-beta.1
- Updated @nest-boot/validator to 8.0.7-beta.1
- Updated @nest-boot/graphql to 8.0.4-beta.1
- Updated @nest-boot/mailer to 8.0.4-beta.1
- Updated @nest-boot/hash to 8.0.4-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.9-beta.1 (2026-10-09)

### 🚀 Features

- ⚠️  **auth:** introduce member-owned API keys and service accounts ([#401](https://github.com/nest-boot/nest-boot/pull/401))

### ⚠️  Breaking Changes

- **auth:** introduce member-owned API keys and service accounts  ([#401](https://github.com/nest-boot/nest-boot/pull/401))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.9-beta.0 (2026-10-09)

### 🧱 Updated Dependencies

- Updated @nest-boot/graphql-connection to 8.0.4-beta.0
- Updated @nest-boot/request-context to 8.0.4-beta.0
- Updated @nest-boot/eslint-config to 8.0.2-beta.2
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.3
- Updated @nest-boot/middleware to 8.0.4-beta.0
- Updated @nest-boot/validator to 8.0.7-beta.0
- Updated @nest-boot/graphql to 8.0.4-beta.0
- Updated @nest-boot/mailer to 8.0.4-beta.0
- Updated @nest-boot/hash to 8.0.4-beta.0

## 8.0.8-beta.0 (2026-10-09)

### 🧱 Updated Dependencies

- Updated @nest-boot/graphql-connection to 8.0.3-beta.0
- Updated @nest-boot/request-context to 8.0.3-beta.0
- Updated @nest-boot/eslint-config to 8.0.2-beta.1
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.2
- Updated @nest-boot/middleware to 8.0.3-beta.0
- Updated @nest-boot/validator to 8.0.6-beta.0
- Updated @nest-boot/graphql to 8.0.3-beta.0
- Updated @nest-boot/mailer to 8.0.3-beta.0
- Updated @nest-boot/hash to 8.0.3-beta.0

## 8.0.7-beta.4 (2026-09-30)

### 🩹 Fixes

- **auth:** honor password policy and selected connection counts ([#358](https://github.com/nest-boot/nest-boot/pull/358))
- ⚠️  **auth:** accurately type credential-free query results ([#382](https://github.com/nest-boot/nest-boot/pull/382))

### ⚠️  Breaking Changes

- **auth:** accurately type credential-free query results  ([#382](https://github.com/nest-boot/nest-boot/pull/382))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.7-beta.3 (2026-09-30)

This was a version bump only for @nest-boot/auth to align it with other projects, there were no code changes.

## 8.0.7-beta.2 (2026-09-30)

### 🩹 Fixes

- **auth:** prevent members from changing their own status ([#379](https://github.com/nest-boot/nest-boot/pull/379))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.7-beta.1 (2026-09-29)

### 🚀 Features

- **auth:** configure API key prefixes per owner scope ([#377](https://github.com/nest-boot/nest-boot/pull/377))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.7-beta.0 (2026-09-24)

### 🧱 Updated Dependencies

- Updated @nest-boot/graphql-connection to 8.0.2-beta.1

## 8.0.6-beta.0 (2026-09-23)

### 🧱 Updated Dependencies

- Updated @nest-boot/graphql-connection to 8.0.2-beta.0
- Updated @nest-boot/request-context to 8.0.2-beta.0
- Updated @nest-boot/eslint-config to 8.0.2-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.1
- Updated @nest-boot/middleware to 8.0.2-beta.0
- Updated @nest-boot/validator to 8.0.5-beta.0
- Updated @nest-boot/graphql to 8.0.2-beta.0
- Updated @nest-boot/mailer to 8.0.2-beta.0
- Updated @nest-boot/hash to 8.0.2-beta.0

## 8.0.5-beta.6 (2026-09-23)

This was a version bump only for @nest-boot/auth to align it with other projects, there were no code changes.

## 8.0.5-beta.5 (2026-09-23)

This was a version bump only for @nest-boot/auth to align it with other projects, there were no code changes.

## 8.0.5-beta.4 (2026-09-20)

This was a version bump only for @nest-boot/auth to align it with other projects, there were no code changes.

## 8.0.5-beta.3 (2026-09-20)

This was a version bump only for @nest-boot/auth to align it with other projects, there were no code changes.

## 8.0.5-beta.2 (2026-09-20)

### 🚀 Features

- ⚠️  **auth:** separate API key permission configuration by scope ([#349](https://github.com/nest-boot/nest-boot/pull/349))

### ⚠️  Breaking Changes

- **auth:** separate API key permission configuration by scope  ([#349](https://github.com/nest-boot/nest-boot/pull/349))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.5-beta.1 (2026-09-20)

### 🩹 Fixes

- **auth:** expose server-owned API key default selections ([#348](https://github.com/nest-boot/nest-boot/pull/348))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.5-beta.0 (2026-09-20)

### 🧱 Updated Dependencies

- Updated @nest-boot/graphql-connection to 8.0.1-beta.3

## 8.0.4-beta.0 (2026-09-20)

### 🧱 Updated Dependencies

- Updated @nest-boot/graphql-connection to 8.0.1-beta.2

## 8.0.3-beta.2 (2026-09-19)

### 🚀 Features

- ⚠️  **auth:** unify auth entities, services and GraphQL APIs ([#331](https://github.com/nest-boot/nest-boot/pull/331))

### ⚠️  Breaking Changes

- **auth:** unify auth entities, services and GraphQL APIs  ([#331](https://github.com/nest-boot/nest-boot/pull/331))

### 🧱 Updated Dependencies

- Updated @nest-boot/graphql-connection to 8.0.1-beta.1
- Updated @nest-boot/request-context to 8.0.1-beta.0
- Updated @nest-boot/eslint-config to 8.0.1-beta.0
- Updated @nest-boot/eslint-plugin to 8.0.1-beta.0
- Updated @nest-boot/middleware to 8.0.1-beta.0
- Updated @nest-boot/validator to 8.0.4-beta.0
- Updated @nest-boot/tsconfig to 8.0.0-beta.4
- Updated @nest-boot/graphql to 8.0.1-beta.0
- Updated @nest-boot/mailer to 8.0.1-beta.0
- Updated @nest-boot/hash to 8.0.1-beta.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.3-beta.1 (2026-09-16)

### 🚀 Features

- ⚠️  **mikro-orm:** adopt native RLS and remove the custom RLS package ([#329](https://github.com/nest-boot/nest-boot/pull/329))

### ⚠️  Breaking Changes

- **mikro-orm:** adopt native RLS and remove the custom RLS package  ([#329](https://github.com/nest-boot/nest-boot/pull/329))

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.3-beta.0 (2026-09-08)

### 🚀 Features

- ⚠️  **auth:** rebuild authentication and authorization ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### 🩹 Fixes

- **release:** keep beta releases on the v8 line ([#328](https://github.com/nest-boot/nest-boot/pull/328))

### ⚠️  Breaking Changes

- **auth:** rebuild authentication and authorization  ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### 🧱 Updated Dependencies

- Updated @nest-boot/row-level-security to 8.0.5-beta.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 9.0.0-beta.0 (2026-09-08)

### 🚀 Features

- ⚠️  **auth:** rebuild authentication and authorization ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### ⚠️  Breaking Changes

- **auth:** rebuild authentication and authorization  ([#316](https://github.com/nest-boot/nest-boot/pull/316))

### 🧱 Updated Dependencies

- Updated @nest-boot/row-level-security to 8.0.4-beta.0
- Updated @nest-boot/request-context to 8.0.0-beta.6
- Updated @nest-boot/eslint-config to 8.0.0-beta.3
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.3
- Updated @nest-boot/middleware to 8.0.0-beta.3
- Updated @nest-boot/tsconfig to 8.0.0-beta.3
- Updated @nest-boot/mailer to 8.0.0-beta.4
- Updated @nest-boot/hash to 8.0.0-beta.3

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.2 (2026-09-07)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.0-beta.5

## 8.0.1 (2026-09-04)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.0-beta.4

# 8.0.0 (2026-09-01)

### 🚀 Features

- ⚠️  migrate to NestJS 12 and ESM ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### ⚠️  Breaking Changes

- migrate to NestJS 12 and ESM  ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.0-beta.3

### ❤️ Thank You

- Xudong Huang @xudongcc

## 8.0.0-beta.2 (2026-08-31)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.0-beta.2
- Updated @nest-boot/eslint-config to 8.0.0-beta.2
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.2
- Updated @nest-boot/middleware to 8.0.0-beta.2
- Updated @nest-boot/tsconfig to 8.0.0-beta.2

## 8.0.0-beta.1 (2026-08-31)

### 🚀 Features

- ⚠️  migrate to NestJS 12 and ESM ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### ⚠️  Breaking Changes

- migrate to NestJS 12 and ESM  ([#312](https://github.com/nest-boot/nest-boot/issues/312))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 8.0.0-beta.1
- Updated @nest-boot/eslint-config to 8.0.0-beta.1
- Updated @nest-boot/eslint-plugin to 8.0.0-beta.1
- Updated @nest-boot/middleware to 8.0.0-beta.1
- Updated @nest-boot/tsconfig to 8.0.0-beta.1

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.13.6 (2026-08-31)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.6
- Updated @nest-boot/eslint-config to 7.3.5
- Updated @nest-boot/eslint-plugin to 7.2.5
- Updated @nest-boot/middleware to 7.6.6
- Updated @nest-boot/tsconfig to 7.3.5

## 7.13.5 (2026-08-29)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.5
- Updated @nest-boot/eslint-config to 7.3.4
- Updated @nest-boot/eslint-plugin to 7.2.4
- Updated @nest-boot/middleware to 7.6.5
- Updated @nest-boot/tsconfig to 7.3.4

## 7.13.4 (2026-08-29)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.4
- Updated @nest-boot/eslint-config to 7.3.3
- Updated @nest-boot/eslint-plugin to 7.2.3
- Updated @nest-boot/middleware to 7.6.4
- Updated @nest-boot/tsconfig to 7.3.3

## 7.13.3 (2026-08-28)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.3
- Updated @nest-boot/middleware to 7.6.3

## 7.13.2 (2026-08-28)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.2
- Updated @nest-boot/eslint-config to 7.3.2
- Updated @nest-boot/eslint-plugin to 7.2.2
- Updated @nest-boot/middleware to 7.6.2
- Updated @nest-boot/tsconfig to 7.3.2

## 7.13.1 (2026-08-27)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.1
- Updated @nest-boot/eslint-config to 7.3.1
- Updated @nest-boot/eslint-plugin to 7.2.1
- Updated @nest-boot/middleware to 7.6.1
- Updated @nest-boot/tsconfig to 7.3.1

## 7.13.0 (2026-08-12)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.7.0
- Updated @nest-boot/eslint-config to 7.3.0
- Updated @nest-boot/eslint-plugin to 7.2.0
- Updated @nest-boot/middleware to 7.6.0
- Updated @nest-boot/tsconfig to 7.3.0

## 7.12.1 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.6.1
- Updated @nest-boot/eslint-config to 7.2.1
- Updated @nest-boot/eslint-plugin to 7.1.1
- Updated @nest-boot/middleware to 7.5.1
- Updated @nest-boot/tsconfig to 7.2.1

## 7.12.0 (2026-06-17)

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.6.0
- Updated @nest-boot/eslint-config to 7.2.0
- Updated @nest-boot/eslint-plugin to 7.1.0
- Updated @nest-boot/middleware to 7.5.0
- Updated @nest-boot/tsconfig to 7.2.0

## 7.11.2 (2026-06-09)

### 🩹 Fixes

- **auth:** update auth env defaults ([533362c9](https://github.com/nest-boot/nest-boot/commit/533362c9))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.5.0
- Updated @nest-boot/eslint-config to 7.1.0
- Updated @nest-boot/eslint-plugin to 7.0.8
- Updated @nest-boot/middleware to 7.4.0
- Updated @nest-boot/tsconfig to 7.1.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.11.1 (2026-06-07)

### 🩹 Fixes

- **auth:** rename signup disable env vars ([1a1001b](https://github.com/nest-boot/nest-boot/commit/1a1001b))

### 🧱 Updated Dependencies

- Updated @nest-boot/request-context to 7.5.0
- Updated @nest-boot/eslint-config to 7.1.0
- Updated @nest-boot/eslint-plugin to 7.0.8
- Updated @nest-boot/middleware to 7.4.0
- Updated @nest-boot/tsconfig to 7.1.0

### ❤️ Thank You

- Xudong Huang @xudongcc

## 7.11.0 (2026-06-07)

### 🚀 Features

- **auth:** support env-configured auth providers ([7b1bf46](https://github.com/nest-boot/nest-boot/commit/7b1bf46))

### ❤️ Thank You

- Xudong Huang @xudongcc

# @nest-boot/auth

## 7.10.0

### Minor Changes

- 9c35ed2: Expose `AuthGuard.isPublic()` for subclasses and guard mixins.

## 7.9.5

### Patch Changes

- 3b24b53: fix: widen AuthGuard canActivate return type to match Nest CanActivate

## 7.9.4

### Patch Changes

- 3fbaf86: fix(auth): resolve WHERE array being interpreted as OR by MikroORM

## 7.9.3

### Patch Changes

- 3f42c62: add comprehensive TSDoc coverage and translate comments to English

## 7.9.2

### Patch Changes

- 935d7fa: fix(auth): add account configuration to skip state cookie check

## 7.9.1

### Patch Changes

- 427ffc4: fix(auth): compatible with better-auth@^1.4.6

## 7.9.0

### Minor Changes

- 6d45c18: feat(auth): add secret validation with entropy check

## 7.8.0

### Minor Changes

- 345b53d: feat: auth module to use RequestContext for session and user management, and simplify middleware options

## 7.7.5

### Patch Changes

- 372cb9e: chore: use defineConfig to configure eslint
- 372cb9e: fix: add typedoc

## 7.7.4

### Patch Changes

- d663833: fix: eslint

## 7.7.3

### Patch Changes

- e99f023: fix export AuthService

## 7.7.2

### Patch Changes

- bf35af9: fix: update @nestjs packages to version 11.1.9 across multiple packages

## 7.7.1

### Patch Changes

- b64e6b7: fix: 修复 better-auth 没有禁止全局排除路由

## 7.7.0

### Minor Changes

- 3f503c8: feat: MiddlewareManager 支持全局排除路由

## 7.6.0

### Minor Changes

- cae040a: feat: 添加中间件模块，支持中间件排序。

## 7.5.0

### Minor Changes

- 8ae94c8: feat: 添加 baseURL 和 secret 环境变量配置

## 7.4.0

### Minor Changes

- 074c240: feat: 拆分出 auth-rls 和 mikro-orm-request-transaction 模块

## 7.3.0

### Minor Changes

- 95815b4: feat: 添加 @nest-boot/request-context 依赖并更新 AuthInterceptor 以支持请求上下文

### Patch Changes

- 271f5d4: fix: 修复没有导出 AuthInterceptor 和 AuthTransactionContext

## 7.2.0

### Minor Changes

- ca0a526: feat: 添加拦截器，自动启动事务并添加认证上下文

## 7.1.0

### Minor Changes

- d52d5fc: 基于 better-auth 重做 auth 模块
