---
"@nest-boot/eslint": minor
---

Use `nest-boot/<domain>-<rule>` for every Nest Boot ESLint rule. Move `@nest-boot/entity-property-*` to `nest-boot/database-entity-property-*`, `@nest-boot/graphql-field-*` to `nest-boot/graphql-field-*`, and `@nest-boot/queue/processor-name` to `nest-boot/queue-processor-name` in rule settings, inline directives, and suppression files.

To configure rules manually in a flat configuration, register the default export from `@nest-boot/eslint` under `"nest-boot"` (or spread `configs.recommended`).
