---
"@nest-boot/auth": major
---

Store a required, unique `Workspace.slug` and accept workspace IDs and slugs in the
`x-workspace` header. Use `x-workspace` in place of `x-workspace-id`. The
`workspace` cookie also accepts IDs and slugs; use it in place of `workspace_id`.
Add and backfill the slug column before upgrading existing workspaces. The
creation API accepts an optional `slug`; the backend generates a random
30-character slug when omitted. Rename it later through workspace settings.

Enable the Better Auth Username plugin with an optional, unique `User.username`.
Registration, OAuth and ORM creation leave the username unassigned when omitted.
Profile updates can set or change the username, omit it to preserve the current
value, or pass `null` to clear it, following Better Auth's nullable behavior.
The plugin supports username sign-in. The
`workspace` and `user` GraphQL queries accept exactly one identifier, by ID or
by slug and username respectively.

Use the `userExists` and `workspaceExists` GraphQL queries to
check whether an identifier is already in use. PostgreSQL stores usernames and
slugs as `text`. Auth validates their shared lowercase 3–30 character format
with Zod.

Database CHECK constraints also enforce the shared identifier length and ASCII
format for usernames and workspace slugs. MikroORM manages the constraints and
their generated names through entity metadata and migrations.
