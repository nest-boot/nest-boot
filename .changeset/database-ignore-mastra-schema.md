---
"@nest-boot/database": minor
---

Ignore the `mastra` schema by default in `schemaGenerator.ignoreSchema` for both `DatabaseModule` and `getDatabaseConfig()`, preserving the default when partial `schemaGenerator` options are supplied while allowing explicit `ignoreSchema` overrides.
