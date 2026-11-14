---
"@nest-boot/auth": minor
---

Enable tokenized name search for users, workspaces, workspace members, system accounts and all three API-key connections. Maintain hidden search properties and native full-text indexes through the existing database utilities, while preserving exact and prefix email filters. Generate schema migrations from the updated entities before using name search. The example migrations are regenerated for a fresh database. Keep the release in the 8.x series.

Define ApiKey fields and indexes with ordinary decorators, including SearchableProperty. Keep only the optional polymorphic owner mapping, its constraints and RLS on the abstract BaseApiKey schema. Direct ORM consumers register ApiKey together with createBaseApiKeySchema({ user, workspace, system }).
