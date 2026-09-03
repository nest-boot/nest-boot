# @nest-boot/auth

## Authorization TODO

### Release blockers

- [ ] Decide and document API-key `read` semantics. Better Auth Organization
      treats member reads as implicit; either preserve that behavior explicitly
      or require matching `resource:read` permissions for API keys.
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
- [ ] Enforce `userCan` and `workspaceCan` inside authorization-sensitive
      service operations, so direct service injection cannot bypass Resolver or
      Controller metadata. Define explicit internal/system entry points for
      trusted jobs instead of relying on transport guards.
- [x] Make lifecycle roles explicit with `user.defaultRole`,
      `user.adminRoles`, `workspace.defaultRole`, and
      `workspace.creatorRole`. Validate every configured lifecycle role at
      startup and use it throughout User, Workspace, API Key, guard, and adapter
      paths.
- [ ] Add the remaining regression tests for API-key reads without permission
      and over-privileged API-key creation and updates. Unknown direct
      permissions and invalid lifecycle role configuration are covered.

### Follow-ups

- [ ] Support multiple requirements from the same authorization scope on one
      handler, with explicit `all` and `any` matching semantics for repeated
      `@UserCan` and `@WorkspaceCan` declarations.
- [ ] Document permission catalogs, direct-permission validation, reserved-role
      invariants, API-key permission ceilings, and multi-requirement behavior
      after the contracts above are finalized.
