# @nest-boot/auth

## Authorization TODO

### Release blockers

- [x] Require matching API-key permissions for every protected action,
      including `read`, while keeping ordinary workspace-member reads implicit
      through the configured workspace ability.
- [x] Add one shared permission normalizer and validator for configured user and
      workspace permission catalogs. Reject empty, duplicate, and unknown
      permission values at service boundaries.
- [x] Apply permission-catalog validation when creating users and workspace
      members and when calling `setUserPermissions()` or
      `setMemberPermissions()`.
- [x] Validate API-key permissions by owner type: Workspace Keys may contain
      workspace permissions only; User Keys may contain configured user and
      workspace permissions.
- [ ] Prevent API-key privilege escalation on creation and update. User-scoped
      permissions must not exceed the owning user's effective permissions;
      Workspace Key permissions must not exceed the issuing member's effective
      workspace permissions. User Key access to a workspace must continue to be
      intersected with the user's current membership permissions at request
      time.
- [x] Enforce user and workspace abilities inside authorization-sensitive
      `UserService`, `WorkspaceService`, and `ApiKeyService` operations, so
      direct service injection cannot bypass Resolver or Controller metadata.
      Authentication middleware primitives remain internal identity-resolution
      paths rather than privileged business operations.
- [x] Make lifecycle roles explicit with `user.defaultRole`,
      `user.adminRoles`, `workspace.defaultRole`, and
      `workspace.creatorRole`. Validate every configured lifecycle role at
      startup and use it throughout User, Workspace, API Key, guard, and adapter
      paths.
- [ ] Add the remaining regression tests for over-privileged API-key creation
      and updates. Unknown direct permissions, API-key reads, service-level
      authorization, and invalid lifecycle role configuration are covered.

### Follow-ups

- [ ] Support multiple requirements from the same authorization scope on one
      handler, with explicit `all` and `any` matching semantics for repeated
      `@UserCan` and `@WorkspaceCan` declarations.
- [ ] Document permission catalogs, direct-permission validation, reserved-role
      invariants, API-key permission ceilings, and multi-requirement behavior
      after the contracts above are finalized.
