---
"@nest-boot/auth": major
---

Add an optional unique `Workspace.slug` and accept workspace IDs and slugs in
the `x-workspace` header. Migrate callers from `x-workspace-id` to `x-workspace`.
The `workspace_id` cookie accepts IDs. Add a nullable slug column when upgrading
existing workspaces.

Enable the Better Auth Username plugin with an optional unique `User.username`.
Add a nullable username column when migrating existing users. Profile updates
can set or clear a username, and the plugin supports username sign-in. The
`workspace` and `user` GraphQL queries accept exactly one identifier, by ID or
by slug and username respectively.

Use the `userExists` and `workspaceExists` GraphQL queries to
check whether an identifier is already in use. Usernames and workspace slugs share
a lowercase format with a length of 3–30 characters.
