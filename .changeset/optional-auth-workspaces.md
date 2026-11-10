---
"@nest-boot/auth": minor
"@nest-boot/queue-api": patch
---

Make workspace features opt-in with `workspace: { enabled: true }`. Omission, an empty object, and `enabled: false` now load only base authentication. Workspace, member, invitation, service-account, and member API-key services and GraphQL APIs are available only when enabled. Disabled middleware ignores workspace selectors and does not query member credentials or memberships; its default user roles no longer grant workspace creation.

AuthModule selects base or workspace entities from the resolved synchronous or asynchronous options. The exported `entities` array contains base authentication entities and `workspaceEntities` contains the optional models for direct ORM consumers. Remove the inverse `User.members` collection to prevent discovery of optional entities; use `MemberService` instead. Existing workspace users must explicitly enable `workspace: { enabled: true }`.
