---
"@nest-boot/eslint": minor
---

Use `nest-boot/<domain>/<rule>` for every Nest Boot ESLint rule. Move `@nest-boot/entity-property-*` to `nest-boot/database/entity-property-*` and `@nest-boot/graphql-field-*` to `nest-boot/graphql/field-*` in rule settings, inline directives, and suppression files.

To configure rules manually in a flat configuration, register the default export from `@nest-boot/eslint` under `"nest-boot"` (or spread `configs.rules`).
