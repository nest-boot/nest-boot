---
"@nest-boot/auth": major
---

Store a required, unique `Workspace.slug` and accept workspace IDs and slugs in the
`x-workspace` header. Use `x-workspace` in place of `x-workspace-id`. The
`workspace` cookie also accepts IDs and slugs; use it in place of `workspace_id`.
Add and backfill the slug column before upgrading existing workspaces. The
creation API accepts an optional `slug`; the backend generates a random
30-character slug when omitted. Rename it later through workspace settings.

The `workspace` GraphQL query accepts exactly one identifier, by ID or slug.
Use `workspaceExists(slug)` to check whether a slug is already in use.

PostgreSQL stores slugs as `text`. Zod and a database CHECK constraint enforce
3–30 lowercase ASCII letters, digits, and single hyphens, starting with a letter
and ending with a letter or digit. MikroORM manages the constraint and its
generated name through entity metadata and migrations.
