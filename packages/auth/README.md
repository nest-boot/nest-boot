# @nest-boot/auth

Authentication, authorization, built-in MikroORM entities, GraphQL resolvers and
connections are provided by one `AuthModule`. The former `@nest-boot/auth-graphql`
package has been merged here; remove its dependency and `AuthGraphQLModule` import.

The example's handwritten `Initial` migration creates roles and default
privileges; generated migrations create and evolve tables and RLS policies.
Apply the complete migration sequence to a fresh database.

## Source organization

Auth source lives in `common`, `core`, `workspace`, `admin`, and `api-key` feature directories. Each feature retains its own `entities`, `services`, `resolvers`, `inputs`, `objects`, and supporting layers. Unit tests use the tested file's name and sit beside it; HTTP, database and application-bootstrap tests remain under `test`.

Core runtime coordination lives directly under `core`, including provider registration, request identity, enum registration, entity selection and Better Auth setup. Other feature providers live at their feature roots; API-key authentication belongs to `api-key/services`. `common` contains helpers shared across features. Internal imports point to the owning file. Application imports use `@nest-boot/auth`; the public barrel retains the exported API.

## Optional administration and credentials

Administration, workspaces and API keys are independent startup features, all disabled by default. User and workspace key scopes also require explicit activation:

```typescript
AuthModule.forRoot({
  admin: { enabled: true },
  workspace: { enabled: true },
  apiKey: {
    enabled: true,
    user: { enabled: true },
    system: { enabled: true },
    workspace: { enabled: true },
  },
});
```

`admin.enabled` registers user/session administration and independent system accounts. `apiKey.enabled` is the master switch. User keys require `apiKey.user.enabled: true`; workspace keys additionally require `workspace.enabled` and `apiKey.workspace.enabled: true`. System-account authentication requires the master switch and `apiKey.system.enabled: true`, and defaults to false independently of `admin.enabled`. System-account/key management APIs additionally require administration. Enabling APIs does not grant actor permissions: configure roles as before. The example explicitly enables its features and grants ordinary users personal key read/write permissions.

System-only applications register SystemAccount and ApiKey for authentication without exposing system-account GraphQL types or management endpoints. Provision credentials through a trusted seeder or internal ORM code and use them on application-owned APIs; built-in user/system management APIs stay disabled until administration is enabled.

Disabled features register no corresponding services, GraphQL operations or persistence tables. Basic registration, sign-in, user self-service and sessions remain available. AuthModule registers the enabled entity classes and API-key schema; direct ORM consumers select the required models explicitly.

The former `apiKey.member.*` configuration is removed; use `apiKey.workspace.*`. System credential configuration uses `apiKey.system.*` in place of `apiKey.systemAccount.*`. WorkspaceMember credential services and mutation names retain `WorkspaceApiKey` naming.

## Optional workspaces

Workspace features are disabled by default. Enable them with
`AuthModule.forRoot({ workspace: { enabled: true } })`, or return the same options
from `forRootAsync()`. Omission, `{}`, and `enabled: false` all keep them disabled.

This is a startup setting. Use a fresh process when changing feature modes,
because Nest GraphQL retains type and resolver metadata for the process lifetime.

AuthModule automatically registers its enabled entities through `DatabaseModule`.
Use `nb database:migration:*`, `nb database:schema:*`, and `nb database:seeder:*`
from your application's CLI entry to share runtime configuration and entity metadata.
No separate MikroORM config file or auth configuration helper is needed.
For direct ORM consumers, `entities` and `workspaceEntities` contain the complete model, including the native `ApiKeySchema`. Use `createApiKeySchema({ user, workspace, system })` to select enabled credential owners and register the required owner classes alongside it. Auth entities share the application database schema; Auth has no separate schema configuration.

Disabled applications expose no workspace/member/invitation/member-key GraphQL APIs
or user workspace/invitation relation fields. Their middleware ignores workspace
selectors and grants no workspace permissions. Independently enabled user or system-account keys remain available.
`apiKey.workspace` configuration requires workspace features. Workspace services resolve
to `null` when disabled and should only be injected by applications enabling the feature.

Existing applications must set `workspace.enabled: true` before generating migrations
to retain workspace tables. `User.members` was removed to prevent automatic discovery
of optional entities; use `WorkspaceMemberService` for membership queries.

## WorkspaceMember and WorkspaceInvitation rename

Use `WorkspaceMember`,
`WorkspaceInvitation`, `WorkspaceMemberService`, `WorkspaceInvitationService`, and `CurrentWorkspaceMember`.
Workspace ownership remains the
`workspace` relation, and workspace-role configuration still lives under
`workspace`.

WorkspaceMember permissions use `workspace-member:*`, including `workspace-member:invite` for invitation management,
including custom ability builders, stored grants, and application policies.
The example database tables, foreign keys, indexes, policies, and grants use
`workspace_member` / `workspace_invitation`. The regenerated
`Initial → generated schema migrations` and snapshot target a fresh database only;
they are not an in-place migration for existing installations.

`WorkspaceInvitationService.getWorkspaceInvitationByUser(id, user)` and
`getWorkspaceInvitationByWorkspace(id, workspace)` retain explicit parent-scoped lookups.
Connection queries use `WorkspaceMemberConnection` / `WorkspaceInvitationConnection`.
Service checks, request RLS, transaction boundaries, and special execution
contexts are preserved.

## Built-in entities

Auth owns the concrete `User`, `Account`, `Session`, `Verification`,
`Workspace`, `WorkspaceMember`, `WorkspaceInvitation`, `SystemAccount` and `ApiKey` entities, their GraphQL
metadata, relations, RLS policies, and connections. There are no public auth
`Base*` classes or `AuthModuleOptions.entities` overrides.

`ApiKey` is the sole credential persistence class, mapped through native
`EntitySchema` definitions to the automatically named `api_key` table.
`UserApiKey`, `WorkspaceApiKey`, and `SystemApiKey` are ordinary GraphQL DTOs,
each with its own permission enum and concrete identity field. They do not
inherit ORM state or expose stored credential hashes.

`AuthModule` registers the core entities through `DatabaseModule` automatically and
includes workspace models when `workspace.enabled` is true. Use the application's
`nb database:*` commands for schema, migration, and seeding operations; no separate
`mikro-orm.config.ts` is needed. Direct MikroORM consumers register the required entity classes and native API-key schema explicitly. All Auth models share the application database schema; Auth does not read database environment configuration or configure SQL search paths.

Use separate related business entities and additional field resolvers to extend
these models. Import the built-in classes directly for relation targets; do not
redeclare or register replacement auth entities. Role/permission catalogs, ability
builders, delivery callbacks, and provider settings remain configurable.

`Account.user` and `Session.user` are `Ref<User>` relations. Read the owner's ID
through `record.user.id`. The database column remains `user_id` with cascading
deletion. Better Auth continues to use `userId`; the adapter translates it.

## Service method naming

Service methods use explicit domain names without deprecated aliases:

- `UserService.setUserRoles` replaces roles, while `setUserPermissions` replaces
  direct grants. `getEffectiveUserPermissions` and
  `WorkspaceMemberService.getEffectiveWorkspaceMemberPermissions` include role-derived grants.
- `UserApiKeyService` and `WorkspaceApiKeyService` uses `createUserApiKey`, `updateUserApiKey`, `deleteUserApiKey`
  and their workspace counterparts, matching its existing lookup names.
- `WorkspaceMemberService.getWorkspaceMemberByUser(workspace, user)` finds only active
  memberships; `getWorkspaceMember(id)` reads a member in the request's selected workspace.
  It replaces `getWorkspaceMemberById(workspace, memberId)` without an alias. The Service
  requires a selected workspace, checks its read ability, and queries by both
  member ID and workspace using the RLS-scoped manager.
- `SessionService.setSessionCookie` writes response cookies without changing the
  current request's identity, abilities, or RLS scope.
- `AuthService.updateCurrentUser` and `deleteCurrentUser` are self-service flows;
  `UserService.updateUser` and `deleteUser` still target a specified user.
  `AuthService.getAccountInfo` reads provider account information server-side.

`update*` methods patch fields, `set*` methods replace a value or collection, and
domain operations such as `removeWorkspaceMember`, `revokeSession`, and `cancelWorkspaceInvitation`
keep their distinct meanings. These service API renames do not rename GraphQL
fields or the underlying Better Auth APIs.

## Connection query services

Connection-returning methods use `get<Entity>Connection` for an unscoped entity connection
and `get<Entity>ConnectionBy<Parent>` when a parent supplies the query scope.
For example, `getApiKeyConnectionByUser(user, args)` and
`getApiKeyConnectionByWorkspace(workspace, args)` take the parent first and
pagination arguments second. Collection queries use connections rather than separate
array or offset-based APIs. GraphQL field names, arguments, authorization, and
pagination behavior are unchanged.

Use `WorkspaceService.getWorkspaceConnectionByUser(user, args)` and
`WorkspaceMemberService.getWorkspaceMemberConnectionByWorkspace(workspace, args)` for workspace/member connections, and
`UserApiKeyService.getUserApiKeyConnection(user, args)` / `WorkspaceApiKeyService.getWorkspaceApiKeyConnection(workspace, args)`
for API-key connections. Services own authorization, query scopes and
`ConnectionManager` execution. User, session, workspace, member, API-key and
invitation connection reads retain the request's native RLS scope. API-key ownership and credential permission ceilings still apply.

Use the member and invitation connection services to query workspace children;
each service authorizes its own scope. API-key persistence callbacks are private;
transports call the service's connection methods directly.

## WorkspaceInvitation pagination

`WorkspaceMemberService.getWorkspaceMemberUser(member)`,
`WorkspaceInvitationService.getWorkspaceInvitationInviter(invitation)` and
`getWorkspaceInvitationWorkspace(invitation)` implement the corresponding GraphQL relation
fields. Users may read their own member-user association before selecting
a workspace. Other member-user access, including API keys, requires the selected
workspace and global user-scoped `user:read`. WorkspaceInvitation parent access allows either
the recipient's user session or the selected workspace with `workspace-member:invite`.
Reading another inviter's User additionally requires global user-read permission. They re-read parents and targets with injected
`this.em` and request RLS, never using a privileged reference's cached entity.

`WorkspaceInvitationService.getWorkspaceInvitation(id)` is the RLS-backed single-invitation lookup.
It allows the recipient's session or the selected workspace's `workspace-member:invite`
permission, then checks recipient ownership or workspace ownership and instance-level ability.
WorkspaceMember API keys can use the workspace path without a user identity; failing
recipient authorization does not prevent independently authorized workspace access.
It uses the request manager without clearing its native session or disabling filters.
Applications must define recipient SELECT policies
in addition to their workspace policy if invitees may read before membership.
Recipient-specific lookup helpers and pagination retain their explicit authorization
while reading through the request manager. Acceptance and rejection use authorized
cross-identity contexts supplied by infrastructure; creation and cancellation retain request RLS.

`WorkspaceInvitationService.getWorkspaceInvitationConnectionByWorkspace(workspace, args)` and
`getWorkspaceInvitationConnectionByUser(user, args)` return Relay connections rather than arrays.
Pass connection arguments such as `{ first: 20, after: cursor }` and read
`edges`, `pageInfo`, and `totalCount` from the result.

The service calls `ConnectionManager` after authorization, using the request
ORM manager without disabling filters or native RLS. It enforces the selected workspace or
current recipient regardless of caller filters; recipient lists include only
unexpired pending invitations. Deleting a workspace cascades to its invitations.

`@nest-boot/graphql-connection` and `@mikro-orm/sql` are now peer dependencies.
`AuthModule` registers the built-in `WorkspaceInvitationConnection`; no application-owned
connection definition is required. Its GraphQL transport exposes these connections as
`Workspace.invitations` and `User.invitations` field resolvers.

## Authorization TODO

### Release blockers

- [x] Restrict the permissions supplied to configured user and workspace
      Ability builders: User Keys use the intersection with their principal's
      effective permissions; WorkspaceMember Keys likewise intersect with their member's current grants. Empty key permissions inherit the owner's full grants.
- [x] Add one shared permission normalizer and validator for configured user and
      workspace permission catalogs. Reject empty, duplicate, and unknown
      permission values at service boundaries.
- [x] Apply permission-catalog validation when creating users and workspace
      members and when calling `setUserPermissions()` or
      `setWorkspaceMemberPermissions()`.
- [x] Validate API-key permissions by owner type: WorkspaceMember Keys may contain
      workspace permissions only; User Keys may contain configured user and
      workspace permissions.
- [x] Prevent API-key privilege escalation on creation and update. User-scoped
      permissions must not exceed the owning user's effective permissions;
      WorkspaceMember Key permissions must not exceed both the owning member's and the issuer's
      effective workspace permissions. User Key access to a workspace must continue to be
      intersected with the user's current membership permissions at request
      time.
- [x] Add module-level API-key defaults and grant limits, and prevent an
      authenticating API key from delegating permissions it does not have.
- [x] Enforce user and workspace abilities inside authorization-sensitive
      `UserService`, `WorkspaceService`, `WorkspaceMemberService`,
      `WorkspaceInvitationService`, and `UserApiKeyService` and `WorkspaceApiKeyService` operations, so
      direct service injection cannot bypass Resolver or Controller metadata.
      Authentication middleware primitives remain internal identity-resolution
      paths rather than privileged business operations.
- [x] Make lifecycle roles explicit with `user.defaultRole`,
      `user.adminRoles`, `workspace.defaultRole`, and
      `workspace.creatorRole`. Validate every configured lifecycle role at
      startup and use it throughout User, Workspace, API Key, guard, and adapter
      paths.
- [x] Add the remaining regression tests for over-privileged API-key creation
      and updates. Unknown direct permissions, API-key reads, service-level
      authorization, and invalid lifecycle role configuration are covered.

### Follow-ups

- [x] Support multiple requirements from the same authorization scope on one
      handler. Repeated `@Can` and `@Can` declarations always use
      `all` matching semantics.
- [x] Document permission catalogs, direct-permission validation, creator-role
      invariants, API-key permission ceilings, and multi-requirement behavior
      after the contracts above are finalized.

## User and session connections

`UserService.getUserConnection(args)`, `SessionService.getSessionConnectionByUser(user, args)` and `AccountService.getAccountConnectionByUser(user, args)` use the built-in connection definitions registered by `AuthModule`. Own browser-session reads do not require administrative permissions; foreign-user and delegated API-key session reads require `session:read`. Application RLS must grant the corresponding SELECT access. Account connections require the owning user session, reject API keys and exclude credential columns. `UserService.listUserAccounts` is removed without an alias.

`SessionService` owns `getSessionConnectionByUser`,
`getSessionImpersonator`, `revokeSession`, and `revokeUserSessions`;
these are no longer exposed by `UserService`. The GraphQL `User.sessions` field
delegates to `SessionService` even though its parent is a user. Safe reads use
the injected request manager and are not in the privileged operation allowlist.
Administrative revocation keeps its existing `session:revoke` checks and
infrastructure-owned authentication context, including impersonation-session
cleanup. `getCurrentAuthenticatedSession` and `listCurrentUserSessions` retain their credential-hydration
contexts; `listCurrentUserSessions` is not the safe GraphQL listing API.

Administrative single-session revocation is now `revokeSession(userOrId, id)`
(formerly `revokeUserSession`). Browser-session operations are named
`revokeCurrentUserSession(id)`, `revokeCurrentUserSessions()`, and
`revokeCurrentUserOtherSessions()`, replacing the former `revokeSession(id)`,
`revokeSessions()`, and `revokeOtherSessions()` methods without compatibility
aliases. GraphQL revocation operations now use the same names as these methods.

Request-bound authentication methods explicitly name the current user:
`verifyCurrentUserPassword`, `changeCurrentUserEmail`,
`changeCurrentUserPassword`, `setCurrentUserPassword`,
`listCurrentUserAccounts`, `linkCurrentUserAccount`, and
`unlinkCurrentUserAccount`. Their former names without `CurrentUser` are removed.
`getCurrentAuthenticatedSession()` replaces `getSession()` and still returns
the authenticated `{ user, session }` pair; `listCurrentUserSessions()` replaces
`listSessions()`. Both retain their infrastructure-owned authentication context.
Better Auth API names, configuration keys, and input properties are unchanged.

User bans and identity impersonation remain user-administration workflows in
`UserService`; `AuthService` still coordinates identity adoption and cookies.
`WorkspaceMemberService` owns member lookups, pagination, profile updates, roles,
permissions, adding/removing members, and leaving a workspace.
`WorkspaceInvitationService` owns invitation lookups, pagination, creation,
acceptance, rejection, and cancellation. Both are exported and injectable through
`AuthModule`; the old methods are removed from `WorkspaceService`, without aliases.
`WorkspaceService` retains workspace queries, lifecycle operations, full workspace
reads. Creating a workspace still
creates its owner in the same transaction; accepting an invitation still creates
its member in the invitation transaction. No service-to-service dependency or
new privileged context is introduced.
The internal email lookup context moves to `WorkspaceMemberService.getUserForWorkspaceMembership`;
acceptance/rejection contexts move to `WorkspaceInvitationService`. Ordinary
member/invitation reads and writes keep request RLS.
`can()` and `authorize()` evaluate the request-scoped
`AuthAbility` directly.
The internal `RequestIdentity` owns identity checks and publication, while
`UserDeletionService` coordinates atomic deletion across auth-owned entities.
The impersonator relation checks User profile authorization in SessionService;
permission to read a session alone does not reveal its impersonator's profile.

`AuthService.signInEntity` and `signInSocialEntity` return persisted application
users. When a session is issued, its identity, workspace membership, RLS context
and abilities replace the previous request identity before nested selection.
GraphQL registration uses `AuthService.signUpPayload` and returns only
`SignUpPayload { id, token }`, without user relations. A null token does not load
the registered entity or grant authentication. The original DTO-returning
AuthService methods remain available.

## WorkspaceMember API-key creation

`WorkspaceApiKeyService.createWorkspaceApiKey(workspace, { member, ...options })`
accepts an existing member entity or ID. GraphQL accepts `input.memberId`.
Only the caller's own USER member or an active SERVICE_ACCOUNT member in the
selected workspace may own the new key.

Omitting the owner uses the current member. The example form defaults to **You**,
passing the current member ID. Choosing **Service account** displays a searchable
account dropdown. If no account is selected, the frontend first calls `addWorkspaceMember`
to create a service account named after the key, then calls `createWorkspaceApiKey`
with its `memberId`. Account creation requires `workspace-service-account:write`; key creation
requires `workspace-api-key:write`. These are separate operations. With selected
permissions, `addWorkspaceMember` receives `roles: []` and those direct permissions. With
no selection, it omits roles and permissions to use the configured default
workspace role (MEMBER by default).

Empty API-key permissions (`[]`, including explicit `null` normalized to `[]`)
inherit the owning user's or member's complete current permissions. Non-empty
key permissions intersect with the owner's grants. Existing empty-permission
keys follow the same rule. Configured `allowedPermissions` limits explicit
selections; it does not cap inherited owner grants. Restricted credentials
cannot create, read, change, or delete keys that inherit all owner permissions;
their connection queries also exclude inherited keys.

## Service account permissions

`workspace-member:read` and `workspace-member:write` apply to USER members. SERVICE_ACCOUNT members
use `workspace-service-account:read` and `workspace-service-account:write` for profile reads and
creation, update, and deletion. The default OWNER and ADMIN workspace roles
include both service account permissions; MEMBER does not. WorkspaceMember pagination
and lookup only include types the caller can read.

Changing service account roles or direct permissions also requires
`workspace-member:set-roles` or `workspace-member:set-permissions`, respectively, together with
`workspace-service-account:write`. Grant ceilings still apply. API-key management keeps
its separate `workspace-api-key:read` and `workspace-api-key:write` permissions.

## Scoped management writes

Ordinary API-key update/delete, user update/delete and role/permission setters,
workspace update/delete, and member update/remove and role/permission setters
retain the request EntityManager's native RLS session. They also retain Service
ability checks, current-user/workspace ownership checks, permission ceilings,
and lifecycle invariants. Services may resolve the authenticated actor from
RequestContext; resolvers need only pass resource IDs and inputs. RLS is defense
in depth, not a substitute for these checks or for correctly configured policies.

Workspace deletion and member profile edits use the target's `delete` and
`update` abilities, respectively, rather than requiring the caller's creator
role. Editing the creator's shared contact fields follows the same rule;
disabling/removing a creator checks the same member write ability as other members.
Any current member may leave, including the last creator; the workspace is retained.
Creator roles can be assigned or replaced through `setWorkspaceMemberRoles`, subject to
`workspace-member:set-roles` ability and permission-grant checks. Multiple owners are allowed; no
dedicated ownership-transfer operation is provided. API-key update/delete checks both the entity
type and the loaded instance so conditional abilities remain enforced.

API-key writes use `updateUserApiKey(id, input)`,
`updateWorkspaceApiKey(id, input)`, `deleteUserApiKey(id)` and
`deleteWorkspaceApiKey(id)`. The stored owner determines authorization and
permission normalization. User and member management methods accept either an
ID or an entity; `updateWorkspace(id, input)` and `deleteWorkspace(id)`
also accept their existing entity arguments. Passing an ID does not require an
additional read-operation permission, but database SELECT policies still apply.

Apply the example's `Initial → generated schema migrations` before using
these write paths. Custom applications must supply equivalent grants and RLS
policies for their own data-isolation requirements. Default table privileges do not protect individual columns; Services exclude credential hashes and reject API-key ownership changes.
Workspace deletion permanently removes the selected workspace through the request's
RLS-scoped manager. Foreign keys cascade to members and invitations. Users and API-key audit records remain. There is no deletion-specific database
context or restore operation. Successful deletion clears the request's workspace
identity and ability. Keys whose member was deleted retain their metadata and usage timestamps for audit, but cannot authenticate.

Database request contexts use `app.user.id`, `app.workspace.id`, and `app.member.id`.
`app.member.id` identifies the active member in the selected workspace for authenticated
requests, including service accounts; it is empty when no active member is present
and is cleared when workspace access or authentication is revoked.
Application permissions are not passed to the database. Services enforce Ability
checks, custom permission names and API-key ceilings. RLS retains identity-based
ownership and workspace isolation, not permission-name
checks. Authenticated User reads/writes and Session reads must go through Services;
direct ORM/SQL access does not enforce those application authorization rules.

Permission identifiers use lowercase `resource:action` names. Catalog membership,
grant ceilings and API-key intersections use exact string equality; invalid
names are rejected rather than case-converted. Auth owns the mappings for
`user:*`, `session:*`, `workspace:*`, `workspace-member:*`, `workspace-service-account:*`, and scoped API-key
permissions. Custom permission names only grant business abilities through
explicit permission-bound rules; they cannot redefine built-in auth operations.

Scoped user deletion authorizes the root DELETE with Service checks and RLS;
accounts, sessions (including impersonation sessions), memberships and sent invitations are removed atomically by foreign-key cascades. All API-key records remain in `api_key` for audit, including keys belonging to deleted users or members. Authentication reloads the concrete owner and rejects credentials whose owner no longer exists. Workspaces and independent system accounts survive.
Generate and apply these constraints; child deletes can be silently filtered by RLS.
Authentication bootstrap,
creation, invitation acceptance, impersonation and credential administration
retain their separate authorized privileged flows.

## Infrastructure-owned execution contexts

Every domain Service uses its injected `this.em`. Services do not fork managers,
clear RLS sessions, or call privileged execution helpers themselves. `AuthModule`
providers establish isolated contexts for an explicit allowlist: authentication
credential lookup, user/workspace creation, invitation acceptance/rejection,
impersonation, and credential/session administration. Service authorization and
lifecycle checks still run inside those contexts. Ordinary queries and management
writes retain request RLS; workspace deletion only adds its operation tag while
preserving the actor and workspace. Contexts cannot detach an active scoped
transaction, and never mutate the caller's manager.

The ID-only invitation identity lookup runs after acquiring the workspace lock,
using a fresh identity map and a savepoint on the same connection. It temporarily
uses the connection role to read committed identities, then restores the request
role; rollback restores it on failure. This works with a single-connection pool
and preserves the outer transaction's locks and RLS-protected writes.

Leaving a workspace clears the request's member, workspace, ability and workspace
RLS variables after removal commits. Call it outside externally owned transactions
so later operations cannot reuse the departed membership.

Inject Services through `AuthModule` for these special flows. Directly constructing
a Service uses exactly the supplied manager; it does not install those boundaries.

`AuthService.impersonateUser(id)` and `stopImpersonating()` coordinate session
creation/restoration, authenticate the resulting session, refresh request user,
workspace membership, abilities and RLS, then write browser cookies. GraphQL uses
these entry points so nested fields see the new identity in the same mutation.
Administrative user/session mutations resolve IDs inside their Services using
the action's permission, without requiring an additional user-read permission.

The baseline `Initial → generated schema migrations` also supplies API-key creation
and usage tracking through default INSERT/UPDATE privileges and request RLS.
Services exclude credential hashes from ordinary reads and restrict writable fields;
raw SQL is no longer protected by column-level grants.

## Workspace-visible member profiles

Built-in `WorkspaceMember` owns name/email, and `Workspace.members` / `User.members`
own the inverse collections. Raw ORM collections stay hidden from GraphQL;
connection field resolvers provide authorized pagination.

User members reference a User; service-account members have no User. Each member retains its own `name` and nullable `email`.
These are workspace-visible contact details, initialized from the user's profile
when membership is created. They are independent thereafter: member edits do not
change the user's name or login email, and user edits do not synchronize to members.
Authorized callers may update workspace_member name, email and status; roles and permissions
use dedicated setters. Clearing the member email with `null` does not affect login.
The example displays and filters member fields directly, with exact filters and
prefix searches such as `name:Alice*`, without joining private user profiles.

`WorkspaceMember.user` remains a private User relation, not a source of shared
contact details. Reading another user's profile requires global user-read
authorization in the Service; workspace roles alone do not grant it.
The same boundary applies to `WorkspaceInvitation.inviter`: access to an invitation
does not grant access to the inviter's private profile.

Service-account creation and its options/input exports remain removed without
aliases; there is no member type enum. The example now has a two-step fresh-database
baseline, `Initial → generated schema migrations`, which creates required member user
relations and independent name/email fields directly, without historical columns.

The generated baseline User SELECT policy allows authenticated database roles to
read User rows. Services enforce profile visibility through Ability, including
custom permission names and API-key ceilings. Anonymous reads remain denied.
Direct ORM/SQL reads do not enforce profile privacy; expose User data only through
authorized Services. User writes and Session reads likewise rely on Service
authorization, not permission names in database request variables.

This baseline replaces the previous migration history and is intended for empty
databases. Do not apply it on top of an existing schema or merely clear the migration
history table. Back up existing data and plan a separate data-preserving transition
before upgrading an existing database. Update custom entities, filters and GraphQL
documents together.

## Built-in GraphQL API

Configure `AuthModule` once alongside the application GraphQL module. All standard
resolvers, input types, payloads, and connections are exported from this package.
They reference built-in classes directly; no named-type registration, resolver
factories, or application connection definitions are required. Additional application
field resolvers may target these classes without replacing built-in fields.

## Native query migration

- Single-key queries move from root `userApiKey(id)` to `User.apiKey(id)` and from root `apiKey(id)` to `Workspace.apiKey(id)`. They resolve `UserApiKey` and `WorkspaceApiKey`, respectively, with nullable field results and pass their parent to `UserApiKeyService` and `WorkspaceApiKeyService`; mutation authorization is unchanged (see the operation naming migration below). Query through `currentUser { apiKey(id: ...) { id } }` or `currentWorkspace { apiKey(id: ...) { id } }`. Service authorization, ownership filters, permission ceilings and request RLS remain in effect.
- `users` uses `UserConnectionArgs` / `UserConnection` (first/after or last/before, query/filter/orderBy). `ListUsersInput` and `UserListType` are removed.
- `User.accounts` now returns `AccountConnection!` through `AccountService.getAccountConnectionByUser(user, args)`: use `currentUser { accounts(first: 20) { edges { node { id providerId scopes } } pageInfo { hasNextPage endCursor } } }`. The array shape and `UserService.listUserAccounts` are removed. Account inspection requires the owning browser session; API keys are rejected and credentials are excluded.
- Registration/sign-in payloads reference the built-in `User`, not `AuthUserType`. The entity-oriented AuthService methods establish the newly issued session and refresh RLS and abilities before resolving nested fields. Registration without a session does not authenticate the request; protected nested fields still require authentication.
- `authFetchAccessToken`, `authFetchAccountInfo` and `authRefreshToken` are removed, along with their account-selector input and provider credential result types. No deprecated aliases are retained. Read local account bindings through `User.accounts`; provider integrations can use `AuthService.getAccessToken()`, `refreshToken()` and `getAccountInfo()` server-side. These methods are not exposed by the default GraphQL module.
- Single API-key lookups return null for rows outside the owner/permission scope; mutation authorization is unchanged.

The example migration sequence `Initial → generated schema migrations` enables session/account SELECT policies and uses uniform default table privileges. Column-level database protection is intentionally removed. Apply migrations before deploying the new API. Session administrative reads are authorized by Services through Ability; no application permissions are passed to the database. Passwords, API-key hashes and OAuth/session tokens are excluded by Services from ordinary reads and never exposed as entity fields. Authentication bootstrap and special lifecycle operations retain dedicated privileged paths; ordinary management writes retain request RLS and Service authorization.

### Management mutations

Auth builds its own permission-to-ability mappings in `AuthAbilityFactory`;
one `AuthAbility` contains the rules for the current user and optional workspace.
The top-level `buildAbility(rules, context)` receives
`{ user, workspace, member, userPermissions, workspacePermissions }`; identity
fields are nullable and permission sources remain separate.
Use `can({ user: permission }, action, subject, conditions?)` or
`can({ workspace: permission }, action, subject, conditions?)` for permission-bound
business grants and `cannot(action, subject, conditions?)` for restrictions.
Both support field restrictions. `@Can()`, `can()`, and `authorize()`
evaluate this same ability. The frontend queries `currentAbilityRules` and uses
`useAbility()` for both personal and workspace pages. Callbacks are synchronous and return nothing.
They cannot grant operations on built-in auth entities or `all`, access the raw
builder, or replace the resulting ability. Restrictions take precedence over
business grants. The frontend consumes the final serialized rules.

`@Can` now always receives a `CanSubjectCallback`: use `@Can("read", () => User)`
for entity-type checks and `@Can("update", (self: PostResolver, id: string) =>
self.postService.findOneOrFail({ id }))` for record checks. Callbacks run once per
requirement during the request and may return a promise. Direct entity-class
arguments and the `CanSubject` / `CanSubjectFactory` types are removed; use
`CanSubjectCallback` instead. The synchronous, void-returning callback contract
above applies to `buildAbility`, not to `@Can`.

The exported `can()` and `authorize()` functions read the current request's
`AuthAbility` on every call. Identity and workspace changes take effect on the
next check. `getAuthAbility()` returns that concrete instance when you need rules
or the full CASL API; retrieve it again after identity changes and do not cache it
across requests. Missing request context, identity, or prepared ability throws
`ForbiddenException`. With a valid ability, `can()` returns a boolean and
`authorize()` throws when permission is denied.

`authorize()` is also defined on `AuthAbility` itself and works on explicitly
constructed instances outside a request. The standalone `assertCan` and
`getAbility` exports are replaced by `authorize` and `getAuthAbility` without
compatibility aliases. `can` remains available.

The built-in ability denies writing the current member's `status` field, while
preserving permitted profile edits. `WorkspaceMemberService.updateWorkspaceMember` checks each
supplied field before updating and again under the row lock. Frontends should use
`ability.can("write", member, "status")` for enable/disable actions.

Personal keys use `user-api-key:read/write`; member keys use
`workspace-api-key:read/write`. Write covers creation, updates, enabling/disabling,
and deletion without granting reads.
User administrators and workspace owners inherit them; ordinary users and
workspace administrators require explicit role or direct grants. Existing
ownership checks and self-service operations remain enforced by Services.

The `userRoles` and `workspaceRoles` queries return `{ role, grantable }` objects;
`userPermissions` and `workspacePermissions` return `{ permission, grantable }`.
`userApiKeyPermissions` and `workspaceApiKeyPermissions` also return
`{ permission, grantable, default }` entries. `grantable` includes the API-key
allowlist and issuer's grant ceiling; `default` reflects configured defaults.
Editors preselect only `default && grantable`. `workspace-member:invite` allows querying,
creating, and canceling workspace invitations; it does not grant member writes.
Accepting or rejecting one's own invitation requires the recipient's user session,
not invitation management permission.

Configure these independently with `apiKey.user` and `apiKey.workspace`, each
containing `defaultPermissions` and `allowedPermissions`. Defaults are empty;
omitted allowlists permit the scope's catalog, while `allowedPermissions: []` permits no explicit selections. Empty key `permissions` inherit the owner's complete grants.
User keys support both catalogs; member keys only support workspace grants.
The former flat API-key settings are rejected with a migration message.

Module permission catalogs and role maps extend built-in defaults. Same-name
role grants are merged; custom permissions are not automatically granted to
built-in roles. Empty additions preserve defaults. Entity `set*` mutations still
replace stored roles or direct permissions; API-key `allowedPermissions` remains
an explicit ceiling.

Configuration catalogs are immutable snapshots reused by startup validation,
GraphQL enums, and Services. Configure them before module initialization; change
stored user/member roles or direct grants through Services at runtime instead
of mutating module options. Request identity changes still invalidate effective
permission snapshots and rebuild abilities.

Role and permission values remain GraphQL enums. These catalogs retain all configured
options and mark the current principal's grant ceiling, including API-key restrictions.
They do not authorize changes to a particular target. Disable unavailable new grants
in the UI and validate complete replacement lists; mutation Services still enforce
target-specific abilities. `workspaceAssignableRoles` has been removed.
`UserService` and `WorkspaceMemberService` expose these same option shapes through
`listRoles()` and `listPermissions()`, using configured string values internally.
The previous `AuthRole { name, permissions }` catalog shape is no longer exposed.

`createUser`, `updateUser`, `setUserRoles`, `setUserPermissions`, `banUser`, and
`unbanUser` return operation-specific payloads containing only `id`. Refetch
authorized user fields separately after success instead of selecting self-only
relations on an administrative mutation result.
`acceptWorkspaceInvitation` returns `AcceptWorkspaceInvitationPayload { id, memberId, workspaceId }`,
without inviter/profile relations. Select that workspace in the next request
before querying membership details. Domain Services still return entities and
retain their authorization checks.

Resolvers pass resource IDs and inputs to Services, which enforce abilities,
resource ownership, current-workspace restrictions and lifecycle invariants
using request context as needed. Ordinary writes also retain database RLS;
removing actor arguments does not remove Service authorization.

`updateWorkspace(id: ID!, input: UpdateWorkspaceInput!)`,
and `deleteWorkspace(id: ID!)`
now require an explicit workspace ID, which must match the selected workspace.
User management mutation names and inputs are unchanged; see the naming migration below for member API keys.
API-key update/delete Service methods no longer take user/workspace arguments.

`createWorkspace` returns `CreateWorkspacePayload { id: ID! }` and
`deleteWorkspace` returns `DeleteWorkspacePayload { id: ID! }`, not `Workspace`.
These payloads expose no entity or relation fields. Creation does not change the
current request's workspace, abilities, or RLS context; select the returned ID
in a subsequent request to query the new workspace. Deletion returns only its ID
without querying relations of a now-hidden workspace. `updateWorkspace`, member
create/update/role/permission mutations, and invitation create/reject/cancel
mutations also return dedicated ID-only payloads. Query the affected resource
separately with the caller's read permissions.
Clients must remove selections such as `name` or `members` from
these mutation results and regenerate their GraphQL types.

`deleteUser` and `removeWorkspaceMember` likewise return `DeleteUserPayload` and
`RemoveWorkspaceMemberPayload`, each containing only `id: ID!`. `leaveWorkspace` returns
`LeaveWorkspacePayload { memberId: ID! }`, identifying the removed member, not
the workspace. Service return values and authorization are unchanged.
Remove entity-field selections from these mutation results. When evicting a
normalized client cache entry, use the original entity type (`User` or `WorkspaceMember`)
with the returned ID, not the payload's `__typename`.

### Authentication operation naming

Authentication operations no longer use the `auth` prefix. Current-user actions
explicitly include `CurrentUser`; administrative actions do not use an `admin`
prefix. Old operation names are removed, not retained as aliases.

| Previous operation          | Current operation                |
| --------------------------- | -------------------------------- |
| `authSocialProviders`       | `socialProviders`                |
| `authSignUp`                | `signUp`                         |
| `authSignIn`                | `signIn`                         |
| `authSignInSocial`          | `signInSocial`                   |
| `authSignOut`               | `signOut`                        |
| `authSendVerificationEmail` | `sendVerificationEmail`          |
| `authRequestPasswordReset`  | `requestPasswordReset`           |
| `authResetPassword`         | `resetPassword`                  |
| `authUpdateUser`            | `updateCurrentUser`              |
| `authDeleteUser`            | `deleteCurrentUser`              |
| `authChangeEmail`           | `changeCurrentUserEmail`         |
| `authChangePassword`        | `changeCurrentUserPassword`      |
| `authSetPassword`           | `setCurrentUserPassword`         |
| `authLinkSocialAccount`     | `linkCurrentUserAccount`         |
| `authUnlinkAccount`         | `unlinkCurrentUserAccount`       |
| `authRevokeSession`         | `revokeCurrentUserSession`       |
| `authRevokeSessions`        | `revokeCurrentUserSessions`      |
| `authRevokeOtherSessions`   | `revokeCurrentUserOtherSessions` |
| `revokeUserSession`         | `revokeSession`                  |

`revokeUserSessions(userId)` remains the administrative bulk operation.
Input/output type names, arguments, authorization, and behavior are unchanged
by this naming change. In particular, `AuthChangePasswordInput.revokeOtherSessions`
remains a password-change option. Update client documents and regenerate types.

### Target argument naming

GraphQL arguments identifying the operation's target use `id: ID!`:
`acceptWorkspaceInvitation(id)`, `rejectWorkspaceInvitation(id)`, `cancelWorkspaceInvitation(id)`,
`revokeCurrentUserSession(id)`, `unlinkCurrentUserAccount(id)`, and
`revokeSession(userId, id)`. The exported `UserIdInput` also uses `id`, not
`userId`. The old argument names are not retained as aliases. Service signatures
are unchanged, including the account-unlinking adapter's `accountId` property.
Related identifiers remain explicit: `revokeSession.userId` checks ownership,
`revokeUserSessions.userId` selects whose sessions to revoke.
Workspace owner roles use `setWorkspaceMemberRoles(id, input)` like other roles; multiple
owners are allowed, with ability and permission-grant checks enforced by the Service.

Apply `Initial → generated schema migrations` to the example database.
Custom applications need equivalent write policies and atomic user-dependent
cleanup, as described in the auth package's scoped management writes section.

User/session administration, invitation cancellation/rejection pass target IDs to Services instead of fetching targets in Resolvers.
Services enforce the operation's own permissions; a separate read-operation
permission is not required merely to invoke a mutation.

Impersonation mutations delegate to `AuthService.impersonateUser(id)` and
`stopImpersonating()`. They refresh request identity, abilities and native RLS
before nested fields resolve, in addition to updating browser cookies.

Domain Services use injected `this.em` throughout. `AuthModule` infrastructure
owns special authentication/lifecycle contexts; ordinary operations retain
Service checks and request RLS. The fresh-database
`Initial → generated schema migrations` includes grants for RLS-scoped API-key creation
and usage tracking.

## Operation naming migration

This is a breaking schema change; no deprecated aliases are retained:

| Removed name         | Replacement             |
| -------------------- | ----------------------- |
| `createApiKey`       | `createWorkspaceApiKey` |
| `updateApiKey`       | `updateWorkspaceApiKey` |
| `deleteApiKey`       | `deleteWorkspaceApiKey` |
| `currentAuthSession` | `currentSession`        |
| `removeWorkspace`    | `deleteWorkspace`       |

GraphQL exposes `UserApiKey`, `WorkspaceApiKey`, and `SystemApiKey`. Each scope has its own connection/filter/order, `Create*ApiKeyResult`, inputs and permission enum. For example, `WorkspaceApiKey.permissions` uses `WorkspaceApiKeyPermission` for both input and output. Services validate grants against that scope’s catalog and delegation ceiling; stored permission identifiers remain unchanged.

API-key enums cover the full scope catalogs, independently of the current grant
allowlist, so existing keys remain readable after the allowlist is tightened.
WorkspaceMember keys may carry `workspace-member:invite` to read and cancel invitations.
Creating an invitation also requires a user as sender; use a personal API key
for invitation creation.

Update operation documents, ability subject mappings, and generated client types together. The example uses a fresh-database baseline: infrastructure initialization followed by a MikroORM-generated schema that creates the shared API-key table and system accounts directly.

Authentication and successful-use tracking are internal infrastructure responsibilities. Credential lookup queries the shared `api_key` table by hash and restricts matches to enabled identity kinds. `@CurrentApiKey()` returns request credential metadata; use the scoped services to mutate credentials.

## Removed collection APIs

`UserService.listUsers`, `SessionService.listUserSessions`, and
`WorkspaceService.getFullWorkspace` have been removed without aliases, along with
`ListUsersOptions`, `ListUsersResult`, and `FullWorkspace`. Use
`getUserConnection`, `getSessionConnectionByUser`, and the member/invitation
connection methods instead. `listCurrentUserSessions` remains an internal
credential-hydration helper for session revocation, not a GraphQL listing API.

## Internal BetterAuth integration

`AuthModule` owns Nest provider registration and HTTP middleware wiring.
`core/create-auth-instance.ts` validates options, resolves environment/default
precedence with the existing config helpers, and constructs the BetterAuth instance.
`core/better-auth-adapter.ts` derives the auth/session API surface from that
factory's upstream type and owns the untyped injection boundary. Update this boundary
when changing the BetterAuth integration instead of adding service-local API declarations.

Application services retain their public options/results, identity and transaction rules.
They normalize upstream results and use `applyAuthResponseCookies` to forward response
cookies; session cookie creation remains in `SessionService`. Contextual service providers
continue to own request execution and transaction boundaries.

## Independent system accounts and shared credential storage

`UserApiKey`, `WorkspaceApiKey`, and `SystemApiKey` remain scoped TypeScript service and authorization views; GraphQL uses these three distinct object types with their own permission enums. `ApiKey` is the persistent entity. Its required polymorphic `owner` is a `User`, `WorkspaceMember`, or `SystemAccount`, stored as `owner_type` and `owner_id` in `api_key`. No additional scope column or single-table inheritance is used. Credential hashes are globally unique.

For direct ORM operations, query `ApiKey` with the owner discriminator and a typed owner reference. The view classes are not separate ORM entities:

```typescript
import { ApiKey, User } from "@nest-boot/auth";

const keys = await em.find(ApiKey, {
  ownerType: "user",
  owner: em.getReference(User, userId),
});
```

A User with an administrator role and the explicit `system-account:read/write` and `system-account-api-key:read/write` permissions manages system identities. Management requires a human user session; user, member and system API keys cannot issue system credentials. Use `SystemAccountService` for create/read/paginate/update/delete and `SystemApiKeyService` for key lifecycle operations. GraphQL exposes `systemAccounts`, `systemAccount`, `createSystemAccount`, `updateSystemAccount`, `deleteSystemAccount`, `systemApiKey`, and the corresponding key mutations. `User.apiKeys`, `WorkspaceMember.apiKeys`, and `SystemAccount.apiKeys` return their own scoped connections. Root `workspaceApiKeys` and `systemApiKeys` provide aggregate lists. GraphQL exposes nullable `UserApiKey.user`, `WorkspaceApiKey.member`, and `SystemApiKey.systemAccount`, with separate identity authorization and self-profile access. Inaccessible identities return null. Disabled credential APIs introduce no schema dependencies; keys expose no generic owner union or redundant identity ID fields.

SystemAccount holds a name, enabled state, explicit permission ceiling and creator audit reference. A workspace service account remains a WorkspaceMember with `type: SERVICE_ACCOUNT`; it is separate from this platform identity. Creator references use `ON DELETE SET NULL`, so deleting a creator does not delete the system account or its keys.

```graphql
mutation {
  createSystemAccount(
    input: {
      name: "Reporting integration"
      permissions: [USER__READ, WORKSPACE__READ_ANY]
    }
  ) {
    id
  }
}
```

Create its credential with `createSystemApiKey(systemAccountId, input)` and send the returned plaintext as `Authorization: Bearer <key>`. The plaintext is returned once; metadata queries never return its hash or plaintext. The default prefix is `sys_`, configurable through `apiKey.system.defaultPrefix` (or `API_KEY_PREFIX`). Its `allowedPermissions` and `defaultPermissions` follow the existing scoped configuration shape.

System-key grants are the intersection of the account's current permissions, the key's explicit permissions and the configured key allowlist. An empty system-key grant list grants nothing. Disabling the account invalidates every owned key on subsequent requests; revoking, expiring or deleting one key affects that key. System authentication creates no User, WorkspaceMember or selected-workspace identity.

The built-in system catalog is `user:read`, `user:update`, `user:delete`, `workspace:read-any`, `workspace:update-any`, and `workspace:delete-any`. Existing user operations enforce their User ability grants. Workspace platform operations are separate: `workspaces`, `platformWorkspace(id)`, `updatePlatformWorkspace(id, input)`, and `deletePlatformWorkspace(id)`. Ordinary membership-scoped APIs retain their existing checks. Workspace grants are ineffective when workspace features are disabled. No system grant automatically authorizes arbitrary business tables.

Polymorphic relations have no native owner FK or custom owner triggers. Deleting User, WorkspaceMember, SystemAccount or a workspace retains API-key records and their stored owner identifiers for audit. Authentication reloads the concrete owner with a fresh database query and rejects missing, disabled or banned identities. Failed authentication does not delete the record or update its usage timestamps. There is no lazy or scheduled cleanup. System-key audit queries retain metadata and return a null related account when it has been deleted. With system credentials enabled, `SystemAccountService.deleteSystemAccount` revokes the account's keys and deletes the account in one transaction. Retained keys can be renamed, revoked or explicitly deleted; changing their grants requires an existing account. Direct ORM/SQL owner deletion still leaves keys unusable through the missing-owner authentication check.

System credentials and accounts are unavailable to request-role SQL; their management services require an administrator session. The framework records successful key usage through an isolated writer restricted to the captured key ID.

The example client manages credentials under `/admin/api-keys` and independent system accounts under `/admin/system-accounts`. Creating a key can select an existing enabled account or create one with the key name and selected permissions, matching workspace service-account key creation. Secrets are displayed once. `systemApiKeys` lists system credentials across accounts, and `systemApiKeyPermissions` returns configured key choices bounded by issuer grants and an optional account ceiling; pass `apiKeyId` to inspect an existing key’s account ceiling without exposing its owner. Supplying both `apiKeyId` and `systemAccountId` is rejected. `systemAccountPermissions` lists account grants; `SystemAccount.apiKeyPermissions` provides account-scoped key choices. Re-enabling a system account validates its resulting delegation ceiling. All management operations require an administrator session and the corresponding Ability permissions.

GraphQL permission field resolvers omit stored values absent from the current enum catalog for `User`, `WorkspaceMember`, `SystemAccount` and all three API-key types. They do not rewrite stored grants or authentication permissions. In particular, a key whose grants are all retired remains restricted even though its GraphQL permission list is empty.

API-key editors submit only changed permission fields. Metadata-only user/workspace key updates preserve retired grants, while expiration changes still validate permission ceilings. Role grantability and role assignment use the same enabled-feature permission set as the issuer, so disabled credential features do not prevent delegating otherwise authorized admin or workspace-owner roles.

API keys use `revokedAt: Date | null` instead of an `enabled` column or field. `revokeUserApiKey`, `revokeWorkspaceApiKey` and `revokeSystemApiKey` record the first server-generated revocation timestamp and retain the row for audit. Revocation is permanent and idempotent, including under concurrent calls; update inputs expose neither `enabled` nor `revokedAt`, so clients cannot clear the timestamp to restore a key. Revoking the authenticating credential clears request authorization only after the database write succeeds. Authentication refreshes stored key state before accepting it. The client shows Revoked and offers no enable/disable toggle. Explicit deletion remains a separate operation.

Persistence services and `ApiKeyLifecycle` work with native `ApiKey` records, including native records queried without their hash. Owner validation narrows only the polymorphic relation. Public service results and committed request identities are projected into `UserApiKey`, `WorkspaceApiKey` or `SystemApiKey` DTOs; updates never publish an ORM-managed entity as the request credential. Use these concrete DTO types directly instead of the removed identity alias `ApiKeyMetadata<T>`.
