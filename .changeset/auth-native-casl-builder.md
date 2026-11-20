---
"@nest-boot/auth": minor
---

Change `buildAbility` to one context argument, `({ builder, permissions, workspace, ... })`, with a native CASL `AbilityBuilder<AuthAbility>`, including standard `can`/`cannot` arguments, `.because()`, field overloads, and last-matching-rule precedence. Add a readonly, deduplicated `context.permissions` combining credential-limited user and authenticated-workspace grants; source-specific arrays remain available when provenance matters.

Remove the obsolete `AbilityRules` wrapper and use native `AbilityBuilder<AuthAbility>` types. Move the builder into the single context argument. Migrate `can({ user: permission }, ...)` and `can({ workspace: permission }, ...)` to an explicit effective permission check followed by standard CASL `can(...)`. The callback is trusted application policy: unconditional grants (including built-in subjects and `all`) are no longer permission-bound by the framework. Place `cannot` after grants when it must win. Configuration remains synchronous; callback return values are ignored and promises are rejected.
