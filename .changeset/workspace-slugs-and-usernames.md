---
"@nest-boot/auth": major
---

Require a unique `Workspace.slug` and accept workspace IDs and slugs in the
`x-workspace` header. Use `x-workspace` in place of `x-workspace-id`. The
`workspace_id` cookie continues to accept IDs. Add and backfill the slug column
before upgrading existing workspaces, and include `slug` in workspace creation
inputs.

Enable the Better Auth Username plugin with an optional unique `User.username`.
Add a nullable username column when migrating existing users. Profile updates
can set or clear a username, and the plugin supports username sign-in. The
`workspace` and `user` GraphQL queries accept exactly one identifier, by ID or
by slug and username respectively.

Use the `userExists` and `workspaceExists` GraphQL queries to
check whether an identifier is already in use. Usernames and workspace slugs share
a lowercase format with a length of 3–30 characters.
